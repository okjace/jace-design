'use client';
// Turn PDFs and PowerPoint files into Jace Design designs (in the browser; nothing is uploaded to read them).
import { blankPage, imageEl, shapeEl, textEl, uid } from './design';
import { tableEl } from './blocks';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38';

// ---------- PDF: each page becomes a page (as a sharp picture of it) ----------
export async function pdfToPages(file, { width, height, onProgress, maxPages = 60 } = {}) {
  const pdfjs = await import(/* webpackIgnore: true */ `${PDFJS}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  // A new design takes the PDF's own page size (in screen pixels); inserting into a design fits each page in.
  const W = width || Math.round(first.width * (96 / 72));
  const H = height || Math.round(first.height * (96 / 72));
  const pages = [];
  for (let i = 1; i <= n; i++) {
    onProgress?.(`Reading PDF page ${i} of ${n}…`);
    const pg = await doc.getPage(i);
    const vp1 = pg.getViewport({ scale: 1 });
    const scale = Math.min(3, Math.max(1, (Math.max(W, H) * 1.5) / Math.max(vp1.width, vp1.height)));
    const vp = pg.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const s = Math.min(W / c.width, H / c.height);
    const w = c.width * s, h = c.height * s;
    pages.push({ ...blankPage(), elements: [imageEl({ src: c.toDataURL('image/jpeg', 0.88), x: (W - w) / 2, y: (H - h) / 2, w, h })] });
  }
  return { width: W, height: H, pages, total: doc.numPages };
}

// ---------- PowerPoint (.pptx): slides with their text, pictures, shapes and tables ----------
const EMU = 9525; // EMUs per screen pixel
const kids = (el, name) => (el ? [...el.children].filter((c) => c.tagName === name) : []);
const kid = (el, name) => kids(el, name)[0] || null;
const deep = (el, name) => (el ? el.getElementsByTagName(name)[0] || null : null);
const num = (v, d = 0) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const dir = (path) => path.slice(0, path.lastIndexOf('/') + 1);
function resolve(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dir(base) + target).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

async function readRels(zip, path) {
  const relPath = `${dir(path)}_rels/${path.slice(path.lastIndexOf('/') + 1)}.rels`;
  const f = zip.file(relPath);
  const map = {};
  if (!f) return map;
  for (const r of parseXml(await f.async('text')).getElementsByTagName('Relationship')) {
    map[r.getAttribute('Id')] = { target: resolve(path, r.getAttribute('Target')), type: r.getAttribute('Type') || '', external: r.getAttribute('TargetMode') === 'External' };
  }
  return map;
}

function themeColors(xml) {
  const map = {};
  const scheme = xml ? deep(xml, 'a:clrScheme') : null;
  if (!scheme) return map;
  for (const c of scheme.children) {
    const name = c.tagName.replace('a:', '');
    const v = deep(c, 'a:srgbClr')?.getAttribute('val') || deep(c, 'a:sysClr')?.getAttribute('lastClr');
    if (v) map[name] = `#${v.toLowerCase()}`;
  }
  return { ...map, tx1: map.dk1, bg1: map.lt1, tx2: map.dk2, bg2: map.lt2 };
}

function colorOf(fill, theme) {
  if (!fill) return null;
  const s = kid(fill, 'a:srgbClr');
  if (s) return `#${s.getAttribute('val').toLowerCase()}`;
  const sc = kid(fill, 'a:schemeClr');
  if (sc) return theme[sc.getAttribute('val')] || null;
  const sys = kid(fill, 'a:sysClr');
  if (sys) return `#${(sys.getAttribute('lastClr') || '000000').toLowerCase()}`;
  return null;
}

function xfrmOf(spPr) {
  const x = kid(spPr, 'a:xfrm');
  if (!x) return null;
  const off = kid(x, 'a:off'), ext = kid(x, 'a:ext');
  if (!off || !ext) return null;
  return {
    x: num(off.getAttribute('x')) / EMU, y: num(off.getAttribute('y')) / EMU,
    w: num(ext.getAttribute('cx')) / EMU, h: num(ext.getAttribute('cy')) / EMU,
    rot: num(x.getAttribute('rot')) / 60000, flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1',
  };
}

// Placeholders (title, body…) often get their position from the slide layout or master.
function placeholderKey(sp) {
  const ph = deep(kid(sp, 'p:nvSpPr') || kid(sp, 'p:nvPicPr'), 'p:ph');
  if (!ph) return null;
  return { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') };
}
function findPlaceholder(xml, key) {
  if (!xml || !key) return null;
  for (const sp of xml.getElementsByTagName('p:sp')) {
    const k = placeholderKey(sp);
    if (!k) continue;
    if ((key.idx && k.idx === key.idx) || k.type === key.type || (key.type === 'body' && k.type === 'body')) return sp;
  }
  return null;
}

const SHAPES = { rect: 'rect', roundRect: 'rect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'triangle', star5: 'star', heart: 'heart', hexagon: 'hexagon', diamond: 'diamond', rightArrow: 'arrow', wedgeRectCallout: 'speech', wedgeRoundRectCallout: 'speech' };

function textOf(txBody, theme, fallbackSize) {
  const paras = kids(txBody, 'a:p');
  let size = null, bold = false, italic = false, color = null, font = null, align = 'left';
  const lines = paras.map((p) => {
    const pPr = kid(p, 'a:pPr');
    const al = pPr?.getAttribute('algn');
    if (al) align = al === 'ctr' ? 'center' : al === 'r' ? 'right' : 'left';
    const bullet = pPr && (kid(pPr, 'a:buChar') || kid(pPr, 'a:buAutoNum')) ? '• ' : '';
    const runs = [...kids(p, 'a:r'), ...kids(p, 'a:fld')];
    for (const r of runs) {
      const rPr = kid(r, 'a:rPr');
      if (rPr && size == null && rPr.getAttribute('sz')) size = num(rPr.getAttribute('sz')) / 100;
      if (rPr?.getAttribute('b') === '1') bold = true;
      if (rPr?.getAttribute('i') === '1') italic = true;
      if (rPr && !color) color = colorOf(kid(rPr, 'a:solidFill'), theme);
      const tf = kid(rPr, 'a:latin')?.getAttribute('typeface');
      if (tf && !font && !tf.startsWith('+')) font = tf;
    }
    return bullet + runs.map((r) => kid(r, 'a:t')?.textContent || '').join('');
  });
  const text = lines.join('\n').replace(/\n+$/, '');
  return { text, size: size || fallbackSize, bold, italic, color, font, align };
}

export async function pptxToDesign(file, { onProgress } = {}) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const presPath = 'ppt/presentation.xml';
  const pres = parseXml(await zip.file(presPath).async('text'));
  const sz = deep(pres, 'p:sldSz');
  const W = Math.round(num(sz?.getAttribute('cx'), 12192000) / EMU);
  const H = Math.round(num(sz?.getAttribute('cy'), 6858000) / EMU);
  const presRels = await readRels(zip, presPath);
  const slideIds = [...pres.getElementsByTagName('p:sldId')].map((s) => s.getAttribute('r:id'));
  const themeRel = Object.values(presRels).find((r) => r.type.endsWith('/theme'));
  const theme = themeColors(themeRel && zip.file(themeRel.target) ? parseXml(await zip.file(themeRel.target).async('text')) : null);
  const media = new Map();
  const dataUrl = async (path) => {
    if (media.has(path)) return media.get(path);
    const f = zip.file(path);
    if (!f) return null;
    const ext = path.split('.').pop().toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' }[ext];
    if (!mime) return null; // EMF/WMF and friends can't be shown in a browser
    let url = `data:${mime};base64,${await f.async('base64')}`;
    if (mime === 'image/bmp') url = null;
    media.set(path, url);
    return url;
  };

  const pages = [];
  for (let si = 0; si < slideIds.length; si++) {
    const rel = presRels[slideIds[si]];
    if (!rel || !zip.file(rel.target)) continue;
    onProgress?.(`Reading slide ${si + 1} of ${slideIds.length}…`);
    const path = rel.target;
    const slide = parseXml(await zip.file(path).async('text'));
    const rels = await readRels(zip, path);
    const layoutRel = Object.values(rels).find((r) => r.type.endsWith('/slideLayout'));
    const layout = layoutRel && zip.file(layoutRel.target) ? parseXml(await zip.file(layoutRel.target).async('text')) : null;
    const layoutRels = layoutRel ? await readRels(zip, layoutRel.target) : {};
    const masterRel = Object.values(layoutRels).find((r) => r.type.endsWith('/slideMaster'));
    const master = masterRel && zip.file(masterRel.target) ? parseXml(await zip.file(masterRel.target).async('text')) : null;

    const page = { ...blankPage(), notes: '' };
    // Background: the slide's, else the layout's, else the master's.
    for (const src of [[slide, rels, path], [layout, layoutRels, layoutRel?.target], [master, {}, masterRel?.target]]) {
      const bgPr = src[0] ? deep(src[0], 'p:bgPr') : null;
      if (!bgPr) continue;
      const c = colorOf(kid(bgPr, 'a:solidFill'), theme);
      const blip = deep(bgPr, 'a:blip');
      const bRel = blip ? (src[1][blip.getAttribute('r:embed')] || null) : null;
      const img = bRel ? await dataUrl(bRel.target) : null;
      if (img) { page.background = { type: 'image', src: img, color: c || '#ffffff' }; break; }
      if (c) { page.background = { type: 'color', color: c }; break; }
    }

    const els = [];
    const walk = async (tree, off = { dx: 0, dy: 0, sx: 1, sy: 1 }) => {
      for (const node of tree.children) {
        const tag = node.tagName;
        if (tag === 'p:grpSp') {
          // Groups have their own coordinate space.
          const gx = kid(kid(node, 'p:grpSpPr'), 'a:xfrm');
          const o = kid(gx, 'a:off'), e = kid(gx, 'a:ext'), co = kid(gx, 'a:chOff'), ce = kid(gx, 'a:chExt');
          let next = off;
          if (o && e && co && ce) {
            const sx = num(e.getAttribute('cx')) / (num(ce.getAttribute('cx')) || 1), sy = num(e.getAttribute('cy')) / (num(ce.getAttribute('cy')) || 1);
            next = {
              sx: off.sx * sx, sy: off.sy * sy,
              dx: off.dx + off.sx * (num(o.getAttribute('x')) / EMU - (num(co.getAttribute('x')) / EMU) * sx),
              dy: off.dy + off.sy * (num(o.getAttribute('y')) / EMU - (num(co.getAttribute('y')) / EMU) * sy),
            };
          }
          await walk(node, next);
          continue;
        }
        const place = (b) => (b ? { x: off.dx + b.x * off.sx, y: off.dy + b.y * off.sy, w: b.w * off.sx, h: b.h * off.sy, rotation: b.rot || 0 } : null);
        if (tag === 'p:sp') {
          const spPr = kid(node, 'p:spPr');
          let box = xfrmOf(spPr);
          const key = placeholderKey(node);
          let inherited = null;
          if (!box && key) {
            inherited = findPlaceholder(layout, key) || findPlaceholder(master, key);
            box = inherited ? xfrmOf(kid(inherited, 'p:spPr')) : null;
          }
          const b = place(box);
          if (!b) continue;
          const fill = colorOf(kid(spPr, 'a:solidFill'), theme);
          const geom = kid(spPr, 'a:prstGeom')?.getAttribute('prst') || 'rect';
          const ln = kid(spPr, 'a:ln');
          const stroke = ln && !kid(ln, 'a:noFill') ? colorOf(kid(ln, 'a:solidFill'), theme) : null;
          if (fill || stroke) {
            els.push(shapeEl(SHAPES[geom] || 'rect', { ...b, fill: fill || '', stroke: stroke || '#000000', strokeWidth: stroke ? Math.max(1, num(ln.getAttribute('w'), 12700) / EMU) : 0, radius: geom === 'roundRect' ? Math.min(b.w, b.h) * 0.12 : 0 }));
          }
          const tx = kid(node, 'p:txBody');
          if (tx) {
            const isTitle = key && /title/i.test(key.type);
            const t = textOf(tx, theme, isTitle ? 40 : 18);
            if (t.text.trim()) {
              const fontSize = Math.max(6, t.size * (96 / 72) * off.sy);
              const anchor = kid(tx, 'a:bodyPr')?.getAttribute('anchor');
              els.push(textEl({
                text: t.text, x: b.x + 6, y: anchor === 'ctr' ? b.y + Math.max(0, b.h / 2 - fontSize * 0.7) : b.y + 4, w: Math.max(20, b.w - 12), rotation: b.rotation,
                fontSize, fontWeight: t.bold || isTitle ? 700 : 400, italic: t.italic, align: t.align,
                color: t.color || theme.tx1 || '#111111', fontFamily: t.font || 'Inter', lineHeight: 1.15,
              }));
            }
          }
          continue;
        }
        if (tag === 'p:pic') {
          const b = place(xfrmOf(kid(node, 'p:spPr')));
          const blip = deep(node, 'a:blip');
          const r = blip ? rels[blip.getAttribute('r:embed')] : null;
          const src = r ? await dataUrl(r.target) : null;
          if (b && src) els.push(imageEl({ src, ...b, fit: 'cover' }));
          continue;
        }
        if (tag === 'p:graphicFrame') {
          const tbl = deep(node, 'a:tbl');
          const fx = kid(node, 'p:xfrm');
          const o = kid(fx, 'a:off'), e = kid(fx, 'a:ext');
          if (tbl && o && e) {
            const rows = [...tbl.getElementsByTagName('a:tr')].map((tr) => [...tr.getElementsByTagName('a:tc')].map((tc) => [...tc.getElementsByTagName('a:t')].map((t) => t.textContent).join('')));
            const b = place({ x: num(o.getAttribute('x')) / EMU, y: num(o.getAttribute('y')) / EMU, w: num(e.getAttribute('cx')) / EMU, h: num(e.getAttribute('cy')) / EMU });
            if (rows.length) els.push(tableEl({ ...b, rows, headerBg: theme.accent1 || '#1f9d5a' }));
          }
        }
      }
    };
    const tree = deep(slide, 'p:spTree');
    if (tree) await walk(tree);
    page.elements = els.map((e) => ({ ...e, id: uid() }));
    pages.push(page);
  }
  if (!pages.length) throw new Error('No slides found in that file.');
  return { width: W, height: H, pages };
}
