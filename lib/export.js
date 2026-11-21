'use client';
// Client-side exporters: PNG / JPG / PDF / SVG / Jace Design file.
import { filterCss, HEART_PATH, lineBaseline, shapePoints, textFont, textLines, GOOGLE_FONTS_HREF } from './design';
import { BLOCK_TYPES, SPEAKER, blockShapes, resolveBg } from './blocks';

const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imgCache.get(src);
}

/** Make sure the design-fonts stylesheet (added in the background by FontLoader) has loaded. */
function waitDesignFontSheet() {
  let link = document.querySelector('link[data-design-fonts]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    link.dataset.designFonts = '1';
    document.head.appendChild(link);
  }
  if (link.sheet) return Promise.resolve();
  return new Promise((r) => { link.addEventListener('load', r, { once: true }); link.addEventListener('error', r, { once: true }); setTimeout(r, 5000); });
}

export async function ensureFonts(design) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await waitDesignFontSheet();
  const wanted = new Set();
  for (const p of design.pages) for (const el of p.elements) {
    if (el.type === 'text') wanted.add(`${el.italic ? 'italic ' : ''}${el.fontWeight || 400} 32px "${el.fontFamily}"`);
    if (el.type === 'chart' || el.type === 'table') { wanted.add(`400 32px "${el.fontFamily || 'Inter'}"`); wanted.add(`700 32px "${el.fontFamily || 'Inter'}"`); }
  }
  await Promise.all([...wanted].map((f) => document.fonts.load(f).catch(() => {})));
}

function drawCover(ctx, img, x, y, w, h, contain, focus = 'xMidYMid', natW = img.width, natH = img.height) {
  const ir = natW / natH;
  const r = w / h;
  let sw = natW, sh = natH, sx = 0, sy = 0;
  if (contain) {
    let dw = w, dh = h;
    if (ir > r) dh = w / ir; else dw = h * ir;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return;
  }
  const fx = /xMin/.test(focus) ? 0 : /xMax/.test(focus) ? 1 : 0.5;
  const fy = /YMin/.test(focus) ? 0 : /YMax/.test(focus) ? 1 : 0.5;
  if (ir > r) { sw = natH * r; sx = (natW - sw) * fx; } else { sh = natW / r; sy = (natH - sh) * fy; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function gradientPoints(x, y, w, h, angle = 135) {
  const a = (angle - 90) * (Math.PI / 180);
  const dx = (Math.cos(a) / 2) * w, dy = (Math.sin(a) / 2) * h;
  return [x + w / 2 - dx, y + h / 2 - dy, x + w / 2 + dx, y + h / 2 + dy];
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPieces(ctx, pieces) {
  for (const s of pieces) {
    ctx.save();
    if (s.opacity != null) ctx.globalAlpha *= s.opacity;
    if (s.k === 'rect') {
      roundRect(ctx, s.x, s.y, Math.max(0, s.w), Math.max(0, s.h), s.r || 0);
      if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); }
      if (s.stroke) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = s.stroke; ctx.lineWidth = s.sw || 1; ctx.stroke(); }
    } else if (s.k === 'line') {
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = s.stroke; ctx.lineWidth = s.sw || 1;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    } else if (s.k === 'path') {
      const p = new Path2D(s.d);
      if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(p); }
      if (s.stroke) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = s.stroke; ctx.lineWidth = s.sw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(p); }
    } else if (s.k === 'text') {
      ctx.shadowColor = 'transparent';
      ctx.font = `${s.weight || 400} ${s.size}px "${s.font || 'Inter'}", sans-serif`;
      ctx.textAlign = s.anchor === 'middle' ? 'center' : s.anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x, s.y);
    }
    ctx.restore();
  }
}

async function drawElement(ctx, el) {
  if (el.hidden) return;
  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  if (el.blend && el.blend !== 'normal') ctx.globalCompositeOperation = el.blend;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  if (el.rotation) { ctx.translate(cx, cy); ctx.rotate((el.rotation * Math.PI) / 180); ctx.translate(-cx, -cy); }
  if (el.shadow?.on) {
    ctx.shadowColor = el.shadow.color || 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = el.shadow.blur ?? 12;
    ctx.shadowOffsetX = el.shadow.x ?? 4;
    ctx.shadowOffsetY = el.shadow.y ?? 6;
  }
  if (el.type === 'text') {
    if (el.bgColor) {
      // Highlight / button behind the text (buttons use more padding and rounder ends).
      const px = el.fontSize * (el.bgPadX ?? 0.25), py = el.fontSize * (el.bgPadY ?? 0.1);
      const bh = el.h + py * 2;
      ctx.fillStyle = el.bgColor;
      roundRect(ctx, el.x - px, el.y - py, el.w + px * 2, bh, Math.min(bh / 2, el.fontSize * (el.bgRadius ?? 0.2)));
      ctx.fill();
      if (el.bgBorder) { ctx.strokeStyle = el.bgBorder; ctx.lineWidth = Math.max(1, el.fontSize / 16); ctx.stroke(); }
    }
    ctx.font = textFont(el);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${el.letterSpacing || 0}px`;
    ctx.textAlign = el.align === 'center' ? 'center' : el.align === 'right' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    const tx = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
    textLines(el).forEach((line, i) => {
      const y = el.y + lineBaseline(el, i);
      if (el.strokeWidth) { ctx.lineWidth = el.strokeWidth * 2; ctx.strokeStyle = el.stroke; ctx.lineJoin = 'round'; ctx.strokeText(line, tx, y); }
      ctx.fillStyle = el.color;
      ctx.fillText(line, tx, y);
      if (el.underline) {
        const m = ctx.measureText(line).width;
        const lx = ctx.textAlign === 'center' ? tx - m / 2 : ctx.textAlign === 'right' ? tx - m : tx;
        ctx.fillRect(lx, y + el.fontSize * 0.1, m, Math.max(1, el.fontSize / 16));
      }
    });
  } else if (el.type === 'image') {
    const img = await loadImage(el.src);
    if (img) {
      ctx.save();
      if (el.radius) { roundRect(ctx, el.x, el.y, el.w, el.h, el.radius); ctx.clip(); }
      if (el.flipX || el.flipY) {
        ctx.translate(el.flipX ? 2 * el.x + el.w : 0, el.flipY ? 2 * el.y + el.h : 0);
        ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      }
      ctx.filter = filterCss(el.filters);
      drawCover(ctx, img, el.x, el.y, el.w, el.h, el.fit === 'contain', el.focus);
      ctx.restore();
    }
    if (el.strokeWidth) { ctx.lineWidth = el.strokeWidth; ctx.strokeStyle = el.stroke; roundRect(ctx, el.x, el.y, el.w, el.h, el.radius); ctx.stroke(); }
  } else if (el.type === 'line') {
    const y = el.y + el.h / 2;
    const sw = el.strokeWidth || 4;
    const head = el.arrow ? sw * 3 : 0;
    ctx.strokeStyle = el.stroke;
    ctx.fillStyle = el.stroke;
    ctx.lineWidth = sw;
    ctx.lineCap = el.dash ? 'butt' : 'round';
    if (el.dash) ctx.setLineDash([sw * 2.5, sw * 1.5]);
    ctx.beginPath(); ctx.moveTo(el.x, y); ctx.lineTo(el.x + el.w - head * 0.8, y); ctx.stroke();
    if (el.arrow) { ctx.beginPath(); ctx.moveTo(el.x + el.w, y); ctx.lineTo(el.x + el.w - head, y - head * 0.7); ctx.lineTo(el.x + el.w - head, y + head * 0.7); ctx.closePath(); ctx.fill(); }
  } else if (el.type === 'draw') {
    const pts = el.points || [];
    if (pts.length) {
      ctx.strokeStyle = el.stroke || '#16181d';
      ctx.lineWidth = el.strokeWidth || 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(el.x + px * el.w, el.y + py * el.h) : ctx.moveTo(el.x + px * el.w, el.y + py * el.h)));
      ctx.stroke();
    }
  } else if (el.type === 'video') {
    // While playing/recording a video, el._frame is the live <video>; otherwise its still picture.
    ctx.save();
    roundRect(ctx, el.x, el.y, el.w, el.h, el.radius || 0);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(el.x, el.y, el.w, el.h);
    const src = el._frame && el._frame.readyState >= 2 ? el._frame : el.poster ? await loadImage(el.poster) : null;
    if (src) {
      const iw = src.videoWidth || src.width, ih = src.videoHeight || src.height;
      if (iw && ih) drawCover(ctx, src, el.x, el.y, el.w, el.h, el.fit === 'contain', 'xMidYMid', iw, ih);
    }
    ctx.restore();
  } else if (el.type === 'audio') {
    const size = Math.min(el.w, el.h), s = (size / 24) * 0.55;
    ctx.fillStyle = el.color || '#1f9d5a';
    ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx - 12 * s, cy - 12 * s); ctx.scale(s, s);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff'; ctx.fill(new Path2D(SPEAKER.body));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(new Path2D(SPEAKER.waves));
  } else if (BLOCK_TYPES.includes(el.type)) {
    drawPieces(ctx, blockShapes(el));
  } else if (el.type === 'shape') {
    if (el.shape === 'rect') roundRect(ctx, el.x, el.y, el.w, el.h, el.radius);
    else if (el.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(cx, cy, el.w / 2, el.h / 2, 0, 0, Math.PI * 2); }
    else if (el.shape === 'heart') { ctx.translate(el.x, el.y); ctx.beginPath(); const p = new Path2D(HEART_PATH(el.w, el.h)); ctx.fillStyle = el.fill; ctx.fill(p); if (el.strokeWidth) { ctx.lineWidth = el.strokeWidth; ctx.strokeStyle = el.stroke; ctx.stroke(p); } ctx.restore(); return; }
    else {
      const pts = shapePoints(el) || [];
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(el.x + px, el.y + py) : ctx.moveTo(el.x + px, el.y + py)));
      ctx.closePath();
    }
    if (el.gradient) {
      const g = ctx.createLinearGradient(...gradientPoints(el.x, el.y, el.w, el.h, el.gradientAngle ?? 135));
      g.addColorStop(0, el.fill); g.addColorStop(1, el.gradient);
      ctx.fillStyle = g;
    } else ctx.fillStyle = el.fill || 'transparent';
    if (el.fill) ctx.fill();
    if (el.strokeWidth) {
      ctx.shadowColor = 'transparent'; ctx.lineWidth = el.strokeWidth; ctx.strokeStyle = el.stroke; ctx.lineJoin = 'round';
      if (el.borderStyle === 'dashed') ctx.setLineDash([el.strokeWidth * 3, el.strokeWidth * 2]);
      if (el.borderStyle === 'dotted') { ctx.setLineDash([0, el.strokeWidth * 2]); ctx.lineCap = 'round'; }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export async function renderPageToCanvas(design, page, scale = 1) {
  const { registerFonts } = await import('./fonts');
  await registerFonts(design);
  await ensureFonts(design);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(design.width * scale);
  canvas.height = Math.round(design.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  await drawPage(ctx, design, page);
  return canvas;
}

/** Draw a page's background (used by export and by the video renderer). */
export async function drawBackground(ctx, design, page) {
  const W = design.width, H = design.height, bg = resolveBg(design, page) || {};
  if (bg.type === 'none') return;
  if (bg.type === 'gradient') {
    const a = ((bg.angle ?? 135) - 90) * (Math.PI / 180);
    const x = (Math.cos(a) / 2) * W, y = (Math.sin(a) / 2) * H;
    const g = ctx.createLinearGradient(W / 2 - x, H / 2 - y, W / 2 + x, H / 2 + y);
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg.color || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (bg.type === 'image' && bg.src) {
    const img = await loadImage(bg.src);
    if (img) { ctx.save(); ctx.globalAlpha = bg.opacity ?? 1; ctx.filter = filterCss(bg.filters); drawCover(ctx, img, 0, 0, W, H); ctx.restore(); }
  }
}

/** Draw a whole page. `animate(el)` may return { alpha, dx, dy, scale, rotate, text } for video animations. */
export async function drawPage(ctx, design, page, animate) {
  await drawBackground(ctx, design, page);
  for (const el of page.elements) {
    if (!animate) { await drawElement(ctx, el); continue; }
    const a = animate(el);
    if (!a || a.alpha <= 0.001) continue;
    const e = { ...el, opacity: (el.opacity ?? 1) * a.alpha, x: el.x + (a.dx || 0), y: el.y + (a.dy || 0) };
    if (a.lines) e.lines = a.lines; // typewriter: the same line breaks, fewer letters
    if (a.frame) e._frame = a.frame; // a playing video clip
    if ((a.scale && a.scale !== 1) || a.rotate) {
      const cx = el.x + el.w / 2 + (a.dx || 0), cy = el.y + el.h / 2 + (a.dy || 0);
      ctx.save();
      ctx.translate(cx, cy);
      if (a.rotate) ctx.rotate((a.rotate * Math.PI) / 180);
      if (a.scale && a.scale !== 1) ctx.scale(a.scale, a.scale);
      ctx.translate(-cx, -cy);
      await drawElement(ctx, e);
      ctx.restore();
    } else {
      await drawElement(ctx, e);
    }
  }
}

/** Load every image a design uses, so playback doesn't stutter. */
export async function preloadImages(design) {
  const srcs = new Set();
  for (const p of design.pages) {
    if (p.background?.type === 'image' && p.background.src) srcs.add(p.background.src);
    for (const e of p.elements) {
      if (e.type === 'image' && e.src) srcs.add(e.src);
      if (e.type === 'video' && e.poster) srcs.add(e.poster);
    }
  }
  await Promise.all([...srcs].map(loadImage));
}

export function safeName(title) {
  return (title || 'design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'design';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function exportScale(design, quality = 2) {
  const max = Math.max(design.width, design.height) * quality;
  return max > 6000 ? (6000 / Math.max(design.width, design.height)) : quality;
}

export async function exportImage(design, title, { format = 'png', pageIndex = null, quality = 2 } = {}) {
  const pages = pageIndex == null ? design.pages : [design.pages[pageIndex]];
  const scale = exportScale(design, quality);
  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPageToCanvas(design, pages[i], scale);
    const blob = await new Promise((r) => canvas.toBlob(r, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92));
    const n = pages.length > 1 ? `-${i + 1}` : pageIndex != null && design.pages.length > 1 ? `-${pageIndex + 1}` : '';
    downloadBlob(blob, `${safeName(title)}${n}.${format}`);
  }
}

export async function exportPdf(design, title, { quality = 2 } = {}) {
  const { jsPDF } = await import('jspdf');
  const W = design.width, H = design.height;
  const pdf = new jsPDF({ unit: 'px', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', hotfixes: ['px_scaling'], compress: true });
  const scale = exportScale(design, quality);
  for (let i = 0; i < design.pages.length; i++) {
    if (i) pdf.addPage([W, H], W > H ? 'landscape' : 'portrait');
    const canvas = await renderPageToCanvas(design, design.pages[i], scale);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
  }
  pdf.save(`${safeName(title)}.pdf`);
}

export function exportSvg(svgEl, title) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('width', clone.viewBox.baseVal.width);
  clone.setAttribute('height', clone.viewBox.baseVal.height);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `@import url('${GOOGLE_FONTS_HREF.replace(/&/g, '&amp;')}');`;
  clone.insertBefore(style, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  downloadBlob(new Blob([xml], { type: 'image/svg+xml' }), `${safeName(title)}.svg`);
}

export function exportJson(design, title) {
  const file = { format: 'jace-design', version: 1, title, design };
  downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), `${safeName(title)}.jdesign.json`);
}

/** Downscale an image file to a data URL suitable for storing in a design. */
export function fileToDataUrl(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const src = reader.result;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        const img = new Image();
        img.onload = () => resolve({ src, width: img.width || 400, height: img.height || 400 });
        img.onerror = reject;
        img.src = src;
        return;
      }
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const png = file.type === 'image/png' && w * h < 700 * 700;
        resolve({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), width: w, height: h });
      };
      img.onerror = reject;
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
