'use client';
// Turn PDFs and PowerPoint files into Jace Design designs (in the browser; nothing is uploaded to read them).
import { blankPage, imageEl, lineEl, shapeEl, textEl, uid } from './design';
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

const SHAPES = { rect: 'rect', roundRect: 'rect', snipRoundRect: 'rect', round2SameRect: 'rect', ellipse: 'ellipse', triangle: 'triangle', rtTriangle: 'triangle', star5: 'star', star4: 'star', star6: 'star', heart: 'heart', hexagon: 'hexagon', diamond: 'diamond', rightArrow: 'arrow', wedgeRectCallout: 'speech', wedgeRoundRectCallout: 'speech' };
const MASKS = { ellipse: 'circle', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', star5: 'star', heart: 'heart', flowChartDelay: 'arch' };

// Office fonts → free look-alikes with the same sizes (so text wraps the same), and Canva's own font.
const FONT_SWAP = {
  calibri: 'Carlito', 'calibri light': 'Carlito', cambria: 'Caladea', arial: 'Arimo', helvetica: 'Arimo', 'helvetica neue': 'Arimo',
  'times new roman': 'Tinos', times: 'Tinos', 'courier new': 'Cousine', 'segoe ui': 'Open Sans', verdana: 'Open Sans', tahoma: 'Open Sans',
  'canva sans': 'DM Sans', 'canva serif': 'DM Serif Display', 'arial black': 'Archivo Black', impact: 'Anton', georgia: 'Gelasio',
};
const WEIGHTS = [['extra light', 200], ['extralight', 200], ['ultra light', 200], ['thin', 100], ['light', 300], ['regular', 400], ['medium', 500], ['semi bold', 600], ['semibold', 600], ['demi bold', 600], ['extra bold', 800], ['extrabold', 800], ['ultra bold', 800], ['bold', 700], ['black', 900], ['heavy', 900]];

/** "Montserrat Extra Bold Italic" → { family: 'Montserrat', weight: 800, italic: true } (Canva puts styles in the name). */
function fontInfo(name) {
  let n = String(name || '').trim();
  let weight = null, italic = false;
  if (/\bitalic\b/i.test(n)) { italic = true; n = n.replace(/\s*\bitalic\b/i, ''); }
  for (const [w, v] of WEIGHTS) {
    const re = new RegExp(`\\s+${w}$`, 'i');
    if (re.test(n)) { weight = v; n = n.replace(re, ''); break; }
  }
  n = n.trim();
  const swap = FONT_SWAP[n.toLowerCase()];
  return { family: swap || n, weight, italic };
}

const alphaOf = (colorEl) => { const a = colorEl ? deep(colorEl, 'a:alpha') : null; return a ? num(a.getAttribute('val'), 100000) / 100000 : 1; };
const colorElOf = (fill) => (fill ? kid(fill, 'a:srgbClr') || kid(fill, 'a:schemeClr') || kid(fill, 'a:sysClr') || kid(fill, 'a:prstClr') : null);

// Lighten / darken modifiers on theme colors (lumMod / lumOff), roughly like PowerPoint.
function adjust(hex, colorEl) {
  if (!hex || !colorEl) return hex;
  const mod = deep(colorEl, 'a:lumMod'), off = deep(colorEl, 'a:lumOff');
  if (!mod && !off) return hex;
  const m = num(mod?.getAttribute('val'), 100000) / 100000, o = num(off?.getAttribute('val'), 0) / 100000;
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const out = ch.map((c) => Math.round(Math.max(0, Math.min(1, c * m + o)) * 255).toString(16).padStart(2, '0'));
  return `#${out.join('')}`;
}
const PRESET = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', gray: '#808080' };
function colorFull(fill, theme) {
  const el = colorElOf(fill);
  if (!el) return null;
  let c = null;
  if (el.tagName === 'a:srgbClr') c = `#${el.getAttribute('val').toLowerCase()}`;
  else if (el.tagName === 'a:schemeClr') c = theme[el.getAttribute('val')] || null;
  else if (el.tagName === 'a:sysClr') c = `#${(el.getAttribute('lastClr') || '000000').toLowerCase()}`;
  else if (el.tagName === 'a:prstClr') c = PRESET[el.getAttribute('val')] || null;
  return c ? { color: adjust(c, el), alpha: alphaOf(el) } : null;
}

/** A shape's fill: { color, alpha } or { color, gradient, angle } or null (no fill). */
function fillOf(spPr, theme) {
  if (!spPr || kid(spPr, 'a:noFill')) return null;
  const solid = kid(spPr, 'a:solidFill');
  if (solid) return colorFull(solid, theme);
  const grad = kid(spPr, 'a:gradFill');
  if (grad) {
    const stops = [...grad.getElementsByTagName('a:gs')].map((gs) => ({ pos: num(gs.getAttribute('pos')), c: colorFull(gs, theme) })).filter((s) => s.c).sort((a, b) => a.pos - b.pos);
    if (stops.length) {
      const lin = kid(grad, 'a:lin');
      return { color: stops[0].c.color, gradient: stops[stops.length - 1].c.color, angle: (num(lin?.getAttribute('ang'), 5400000) / 60000 + 90) % 360, alpha: stops[0].c.alpha };
    }
  }
  return null;
}

function themeFonts(xml) {
  const major = xml ? deep(deep(xml, 'a:majorFont'), 'a:latin')?.getAttribute('typeface') : null;
  const minor = xml ? deep(deep(xml, 'a:minorFont'), 'a:latin')?.getAttribute('typeface') : null;
  return { '+mj-lt': major || 'Inter', '+mn-lt': minor || 'Inter' };
}

/** Read a text box: text, and the style of most of its letters. */
function textOf(txBody, theme, fonts, fallbackSize) {
  const bodyPr = kid(txBody, 'a:bodyPr');
  const fit = kid(bodyPr, 'a:normAutofit');
  const scale = fit ? num(fit.getAttribute('fontScale'), 100000) / 100000 : 1;
  const lnReduce = fit ? num(fit.getAttribute('lnSpcReduction'), 0) / 100000 : 0;
  const votes = new Map(); // style → letters
  let align = null, lineHeight = null;
  const lines = kids(txBody, 'a:p').map((p) => {
    const pPr = kid(p, 'a:pPr');
    const al = pPr?.getAttribute('algn');
    if (al && !align) align = al === 'ctr' ? 'center' : al === 'r' ? 'right' : al === 'just' ? 'left' : 'left';
    const pct = deep(kid(pPr, 'a:lnSpc'), 'a:spcPct');
    if (pct && lineHeight == null) lineHeight = Math.max(0.6, (num(pct.getAttribute('val'), 100000) / 100000 - lnReduce) * 1.2);
    const bullet = pPr && (kid(pPr, 'a:buChar') || kid(pPr, 'a:buAutoNum')) && !kid(pPr, 'a:buNone') ? '• ' : '';
    const defR = kid(pPr, 'a:defRPr') || kid(p, 'a:endParaRPr');
    const runs = [...p.children].filter((c) => c.tagName === 'a:r' || c.tagName === 'a:fld' || c.tagName === 'a:br');
    let text = bullet;
    for (const r of runs) {
      if (r.tagName === 'a:br') { text += '\n'; continue; }
      const t = kid(r, 'a:t')?.textContent || '';
      const rPr = kid(r, 'a:rPr') || defR;
      const tf = kid(rPr, 'a:latin')?.getAttribute('typeface') || (defR && kid(defR, 'a:latin')?.getAttribute('typeface')) || '+mn-lt';
      const fi = fontInfo(fonts[tf] || tf);
      const style = {
        size: num(rPr?.getAttribute('sz') || defR?.getAttribute('sz'), 0) / 100 || null,
        bold: rPr?.getAttribute('b') === '1' || (fi.weight || 400) >= 600,
        weight: rPr?.getAttribute('b') === '1' ? Math.max(700, fi.weight || 700) : fi.weight || 400,
        italic: rPr?.getAttribute('i') === '1' || fi.italic,
        underline: !!rPr?.getAttribute('u') && rPr.getAttribute('u') !== 'none',
        caps: rPr?.getAttribute('cap') === 'all',
        spacing: num(rPr?.getAttribute('spc'), 0) / 100,
        color: colorFull(kid(rPr, 'a:solidFill'), theme),
        font: fi.family,
      };
      const key = JSON.stringify(style);
      votes.set(key, (votes.get(key) || 0) + t.length + 1);
      text += t;
    }
    return text;
  });
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  const st = best ? JSON.parse(best[0]) : {};
  const ins = (a, d) => num(bodyPr?.getAttribute(a), d) / EMU;
  return {
    text: lines.join('\n').replace(/\n+$/, ''),
    size: (st.size || fallbackSize) * scale,
    weight: st.weight || 400, italic: !!st.italic, underline: !!st.underline, caps: !!st.caps, spacing: (st.spacing || 0) * scale,
    color: st.color, font: st.font || 'Inter', align: align || 'left', lineHeight: lineHeight || 1.2,
    anchor: bodyPr?.getAttribute('anchor') || 't', vertical: /vert/.test(bodyPr?.getAttribute('vert') || ''),
    inset: { l: ins('lIns', 91440), t: ins('tIns', 45720), r: ins('rIns', 91440), b: ins('bIns', 45720) },
  };
}

const sizeCache = new Map();
function imageSize(src) {
  if (!sizeCache.has(src)) {
    sizeCache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || i.width, h: i.naturalHeight || i.height }); i.onerror = () => res(null); i.src = src; }));
  }
  return sizeCache.get(src);
}

const SYSTEM_FONTS = new Set(['inter', 'sans-serif', 'serif']);

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
  const themeXml = themeRel && zip.file(themeRel.target) ? parseXml(await zip.file(themeRel.target).async('text')) : null;
  const theme = themeColors(themeXml);
  const fonts = themeFonts(themeXml);
  const usedFonts = new Set();
  const media = new Map();
  const dataUrl = async (path) => {
    if (media.has(path)) return media.get(path);
    const f = zip.file(path);
    if (!f) return null;
    const ext = path.split('.').pop().toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
    const url = mime ? `data:${mime};base64,${await f.async('base64')}` : null; // EMF/WMF/BMP can't be shown in a browser
    media.set(path, url);
    return url;
  };
  // A picture's best source: the SVG version (sharp at any size) when there is one.
  const blipSrc = async (blipFill, rels) => {
    const blip = deep(blipFill, 'a:blip');
    if (!blip) return null;
    const svg = blip.getElementsByTagName('asvg:svgBlip')[0];
    const svgRel = svg ? rels[svg.getAttribute('r:embed')] : null;
    return (svgRel && (await dataUrl(svgRel.target))) || (rels[blip.getAttribute('r:embed')] ? await dataUrl(rels[blip.getAttribute('r:embed')].target) : null);
  };
  const cropOf = (blipFill) => {
    const r = kid(blipFill, 'a:srcRect');
    if (!r) return null;
    const l = num(r.getAttribute('l')) / 100000, t = num(r.getAttribute('t')) / 100000, rr = num(r.getAttribute('r')) / 100000, b = num(r.getAttribute('b')) / 100000;
    if (!l && !t && !rr && !b) return null;
    return { x: l, y: t, w: Math.max(0.01, 1 - l - rr), h: Math.max(0.01, 1 - t - b) };
  };
  const picture = async (src, blipFill, b, geom, extra = {}) => {
    const crop = cropOf(blipFill);
    const nat = crop ? await imageSize(src) : null;
    const amt = deep(blipFill, 'a:alphaModFix');
    const adj = num(deep(geom, 'a:gd')?.getAttribute('fmla')?.replace(/\D/g, ''), 16667);
    const prst = geom?.getAttribute('prst') || 'rect';
    return imageEl({
      src, ...b, fit: 'fill', // PowerPoint stretches the (cropped) picture to the box
      ...(crop && nat ? { crop, natW: nat.w, natH: nat.h } : {}),
      mask: MASKS[prst] || '', radius: prst === 'roundRect' ? (Math.min(b.w, b.h) * adj) / 100000 : 0,
      opacity: amt ? num(amt.getAttribute('amt'), 100000) / 100000 : 1, ...extra,
    });
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
    const masterRels = masterRel ? await readRels(zip, masterRel.target) : {};

    const page = { ...blankPage(), notes: '' };
    for (const [xml, r] of [[slide, rels], [layout, layoutRels], [master, masterRels]]) {
      const bg = xml ? deep(xml, 'p:bg') : null;
      if (!bg) continue;
      const bgPr = kid(bg, 'p:bgPr');
      const bf = kid(bgPr, 'a:blipFill');
      if (bf) {
        const img = await blipSrc(bf, r);
        if (img) { page.background = { type: 'image', src: img, color: '#ffffff' }; break; }
      }
      const f = fillOf(bgPr, theme);
      if (f?.gradient) { page.background = { type: 'gradient', from: f.color, to: f.gradient, angle: f.angle }; break; }
      if (f) { page.background = { type: 'color', color: f.color }; break; }
      const ref = kid(bg, 'p:bgRef');
      const rc = ref ? colorFull(ref, theme) : null;
      if (rc) { page.background = { type: 'color', color: rc.color }; break; }
    }

    const els = [];
    const walk = async (tree, off = { dx: 0, dy: 0, sx: 1, sy: 1 }) => {
      for (const node of tree.children) {
        const tag = node.tagName;
        const place = (b) => (b ? { x: off.dx + b.x * off.sx, y: off.dy + b.y * off.sy, w: b.w * off.sx, h: b.h * off.sy, rotation: b.rot || 0 } : null);
        if (tag === 'p:grpSp') {
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
        if (tag === 'p:cxnSp') {
          // A straight line (connector): drawn as a line element turned to the right angle.
          const spPr = kid(node, 'p:spPr');
          const raw = xfrmOf(spPr);
          const b = place(raw);
          const ln = kid(spPr, 'a:ln');
          if (!b || !ln || kid(ln, 'a:noFill')) continue;
          const c = colorFull(kid(ln, 'a:solidFill'), theme);
          const sw = Math.max(1, num(ln.getAttribute('w'), 12700) / EMU) * off.sx;
          const len = Math.hypot(b.w, b.h);
          let ang = Math.atan2(b.h, b.w) * 180 / Math.PI;
          if (raw.flipV) ang = -ang;
          if (raw.flipH) ang = 180 - ang;
          const dash = kid(ln, 'a:prstDash')?.getAttribute('val');
          els.push(lineEl({ x: b.x + b.w / 2 - len / 2, y: b.y + b.h / 2 - sw, w: len, h: sw * 2, rotation: ang + (b.rotation || 0), stroke: c?.color || '#000000', strokeWidth: sw, dash: !!dash && dash !== 'solid', opacity: c?.alpha ?? 1 }));
          continue;
        }
        if (tag === 'p:sp') {
          const spPr = kid(node, 'p:spPr');
          let raw = xfrmOf(spPr);
          const key = placeholderKey(node);
          if (!raw && key) {
            const inherited = findPlaceholder(layout, key) || findPlaceholder(master, key);
            raw = inherited ? xfrmOf(kid(inherited, 'p:spPr')) : null;
          }
          const b = place(raw);
          if (!b) continue;
          const geom = kid(spPr, 'a:prstGeom');
          const prst = geom?.getAttribute('prst') || 'rect';
          // A shape filled with a picture (Canva's photo frames come out like this).
          const pf = kid(spPr, 'a:blipFill');
          if (pf) {
            const src = await blipSrc(pf, rels);
            if (src) els.push(await picture(src, pf, b, geom, { flipX: raw.flipH, flipY: raw.flipV }));
          } else {
            const fill = fillOf(spPr, theme);
            const ln = kid(spPr, 'a:ln');
            const stroke = ln && !kid(ln, 'a:noFill') ? colorFull(kid(ln, 'a:solidFill'), theme) : null;
            if (fill || stroke) {
              const adj = num(deep(geom, 'a:gd')?.getAttribute('fmla')?.replace(/\D/g, ''), 16667);
              els.push(shapeEl(SHAPES[prst] || 'rect', {
                ...b, fill: fill?.color || '', gradient: fill?.gradient || '', gradientAngle: fill?.angle ?? 135, opacity: fill?.alpha ?? stroke?.alpha ?? 1,
                stroke: stroke?.color || '#000000', strokeWidth: stroke ? Math.max(1, num(ln.getAttribute('w'), 12700) / EMU) * off.sx : 0,
                radius: prst === 'roundRect' ? (Math.min(b.w, b.h) * adj) / 100000 : 0,
              }));
            }
          }
          const tx = kid(node, 'p:txBody');
          if (tx) {
            const isTitle = key && /title/i.test(key.type);
            const t = textOf(tx, theme, fonts, isTitle ? 40 : 18);
            if (t.text.trim()) {
              const k = Math.min(off.sx, off.sy);
              const fontSize = Math.max(4, t.size * (96 / 72) * k);
              const x = b.x + t.inset.l * off.sx, w = Math.max(10, b.w - (t.inset.l + t.inset.r) * off.sx);
              // Where the text starts depends on top / middle / bottom alignment in the box.
              const perLine = Math.max(1, Math.floor(w / (fontSize * 0.52)));
              const nLines = t.text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
              const textH = nLines * fontSize * t.lineHeight;
              const inner = b.h - (t.inset.t + t.inset.b) * off.sy;
              const top = b.y + t.inset.t * off.sy;
              const y = t.anchor === 'ctr' ? top + Math.max(0, (inner - textH) / 2) : t.anchor === 'b' ? top + Math.max(0, inner - textH) : top;
              if (!SYSTEM_FONTS.has(t.font.toLowerCase())) usedFonts.add(t.font);
              els.push(textEl({
                text: t.text, x, y, w, rotation: b.rotation, fontSize, fontWeight: t.weight, italic: t.italic, underline: t.underline, uppercase: t.caps,
                align: t.align, color: t.color?.color || theme.tx1 || '#111111', opacity: t.color?.alpha ?? 1, fontFamily: t.font,
                lineHeight: t.lineHeight, letterSpacing: t.spacing * (96 / 72) * k,
              }));
            }
          }
          continue;
        }
        if (tag === 'p:pic') {
          const spPr = kid(node, 'p:spPr');
          const raw = xfrmOf(spPr);
          const b = place(raw);
          const bf = kid(node, 'p:blipFill');
          const src = bf ? await blipSrc(bf, rels) : null;
          if (b && src) els.push(await picture(src, bf, b, kid(spPr, 'a:prstGeom'), { flipX: raw.flipH, flipY: raw.flipV }));
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
  return { width: W, height: H, pages, googleFonts: [...usedFonts].slice(0, 20) };
}
