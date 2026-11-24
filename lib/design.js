// Design model shared by the editor, renderer, exporters and server.
// A design: { width, height, pages: [{ id, background, elements: [] }], assets: [] }
// Other kinds: 'doc' (Word-style), 'video' (scenes), 'sheet' (spreadsheet), 'whiteboard', 'website'.
import { normalizeSheets } from './sheet';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const FONTS = [
  'Geist', 'Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Bebas Neue', 'Oswald', 'Lora', 'Merriweather',
  'Raleway', 'Roboto Slab', 'Space Grotesk', 'DM Serif Display', 'Pacifico', 'Lobster', 'Dancing Script',
  'Caveat', 'Permanent Marker', 'Fira Code', 'Abril Fatface', 'Archivo Black',
];

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  FONTS.map((f) => `family=${f.replace(/ /g, '+')}${['Bebas Neue', 'Pacifico', 'Lobster', 'Permanent Marker', 'Abril Fatface', 'Archivo Black', 'DM Serif Display'].includes(f) ? '' : ':wght@400;700'}`).join('&') +
  '&display=swap';

export const PRESET_GROUPS = [
  {
    name: 'Shapes & ratios',
    items: [
      { name: 'Square 1:1', w: 1080, h: 1080, icon: '⬛' },
      { name: 'Rectangle 16:9', w: 1920, h: 1080, icon: '▬' },
      { name: 'Rectangle 4:3', w: 1600, h: 1200, icon: '▭' },
      { name: 'Rectangle 3:2', w: 1800, h: 1200, icon: '▭' },
      { name: 'Wide 2:1', w: 2000, h: 1000, icon: '▬' },
      { name: 'Banner 3:1', w: 2400, h: 800, icon: '━' },
      { name: 'Portrait 4:5', w: 1080, h: 1350, icon: '▯' },
      { name: 'Portrait 2:3', w: 1200, h: 1800, icon: '▯' },
      { name: 'Tall 9:16', w: 1080, h: 1920, icon: '▮' },
    ],
  },
  {
    name: 'Social media',
    items: [
      { name: 'Instagram post', w: 1080, h: 1080, icon: '📷' },
      { name: 'Instagram story', w: 1080, h: 1920, icon: '📱' },
      { name: 'Instagram portrait', w: 1080, h: 1350, icon: '🖼️' },
      { name: 'Facebook post', w: 1200, h: 630, icon: '👍' },
      { name: 'X / Twitter post', w: 1600, h: 900, icon: '🐦' },
      { name: 'Pinterest pin', w: 1000, h: 1500, icon: '📌' },
      { name: 'LinkedIn banner', w: 1584, h: 396, icon: '💼' },
      { name: 'Jace Social post', w: 1200, h: 1200, icon: '💬' },
    ],
  },
  {
    name: 'Video',
    items: [
      { name: 'YouTube thumbnail', w: 1280, h: 720, icon: '▶️' },
      { name: 'JaceTube thumbnail', w: 1280, h: 720, icon: '📺' },
      { name: 'YouTube banner', w: 2560, h: 1440, icon: '🎬' },
      { name: 'TikTok / Reel cover', w: 1080, h: 1920, icon: '🎵' },
    ],
  },
  {
    name: 'Presentations & docs',
    items: [
      { name: 'Presentation 16:9', w: 1920, h: 1080, icon: '📊', pages: 3 },
      { name: 'Presentation 4:3', w: 1024, h: 768, icon: '📽️', pages: 3 },
      { name: 'Document (A4)', w: 794, h: 1123, icon: '📄' },
      { name: 'Document (Letter)', w: 816, h: 1056, icon: '📃' },
      { name: 'Resume', w: 816, h: 1056, icon: '🧑‍💼' },
      { name: 'Whiteboard', w: 3000, h: 2000, icon: '🧠' },
    ],
  },
  {
    name: 'Print',
    items: [
      { name: 'Poster (18×24 in)', w: 1296, h: 1728, icon: '🪧' },
      { name: 'Flyer (A5)', w: 559, h: 794, icon: '📰' },
      { name: 'Business card', w: 1050, h: 600, icon: '🪪', pages: 2 },
      { name: 'Postcard', w: 1800, h: 1200, icon: '✉️', pages: 2 },
      { name: 'Invitation', w: 1500, h: 2100, icon: '💌' },
      { name: 'Greeting card', w: 1500, h: 2100, icon: '🎉', pages: 2 },
      { name: 'Certificate', w: 1123, h: 794, icon: '🏅' },
      { name: 'Sticker', w: 1000, h: 1000, icon: '⭐' },
    ],
  },
  {
    name: 'Marketing & web',
    items: [
      { name: 'Logo', w: 500, h: 500, icon: '🔷' },
      { name: 'Banner ad', w: 728, h: 90, icon: '📣' },
      { name: 'Email header', w: 600, h: 200, icon: '📧' },
      { name: 'Website hero', w: 1920, h: 900, icon: '🌐' },
      { name: 'App icon', w: 1024, h: 1024, icon: '📲' },
      { name: 'Infographic', w: 800, h: 2000, icon: '📈' },
      { name: 'Menu', w: 816, h: 1056, icon: '🍽️' },
      { name: 'Desktop wallpaper', w: 1920, h: 1080, icon: '🖥️' },
    ],
  },
];

export function blankPage(bg = '#ffffff') {
  return { id: uid(), background: { type: 'color', color: bg }, elements: [] };
}

export function blankDesign(w, h, pages = 1) {
  return { width: w, height: h, pages: Array.from({ length: pages }, () => blankPage()), assets: [] };
}

const base = (o) => ({ id: uid(), rotation: 0, opacity: 1, locked: false, hidden: false, ...o });

export function textEl(o) {
  return base({
    type: 'text', text: 'Your text', x: 0, y: 0, w: 400, h: 60, fontFamily: 'Inter', fontSize: 48,
    fontWeight: 400, italic: false, underline: false, uppercase: false, align: 'left', color: '#111111',
    lineHeight: 1.2, letterSpacing: 0, ...o,
  });
}

export function shapeEl(shape, o) {
  return base({ type: 'shape', shape, x: 0, y: 0, w: 200, h: 200, fill: '#1f9d5a', stroke: '#000000', strokeWidth: 0, radius: 0, points: 5, ...o });
}

export function lineEl(o) {
  return base({ type: 'line', x: 0, y: 0, w: 300, h: 8, stroke: '#111111', strokeWidth: 8, dash: false, arrow: false, ...o });
}

export function imageEl(o) {
  return base({ type: 'image', src: '', x: 0, y: 0, w: 300, h: 300, radius: 0, flipX: false, flipY: false, filters: {}, ...o });
}

export function emojiEl(emoji, o) {
  return textEl({ text: emoji, fontFamily: 'Inter', fontSize: 160, w: 200, h: 200, align: 'center', lineHeight: 1.1, ...o });
}

// ---------- Text layout ----------

export function textFont(el, size = el.fontSize) {
  return `${el.italic ? 'italic ' : ''}${el.fontWeight || 400} ${size}px "${el.fontFamily}", sans-serif`;
}

export function approxMeasure(el) {
  const factor = 0.53 * ((el.fontWeight || 400) >= 700 ? 1.07 : 1) * (el.fontFamily === 'Bebas Neue' || el.fontFamily === 'Oswald' ? 0.78 : 1);
  return (s) => [...s].length * el.fontSize * factor + Math.max(0, [...s].length - 1) * (el.letterSpacing || 0);
}

export function wrapText(el, measure) {
  const text = el.uppercase ? (el.text || '').toUpperCase() : el.text || '';
  const max = Math.max(1, el.w);
  const lines = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((x) => x.length);
    let line = '';
    for (const word of words) {
      const test = line + word;
      if (!line || measure(test.trimEnd()) <= max) {
        line = test;
        // Break a single word that's too long on its own.
        while (measure(line.trimEnd()) > max && [...line].length > 1) {
          const chars = [...line];
          let cut = chars.length - 1;
          while (cut > 1 && measure(chars.slice(0, cut).join('')) > max) cut--;
          lines.push(chars.slice(0, cut).join(''));
          line = chars.slice(cut).join('');
        }
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function textLines(el) {
  return el.lines && el.lines.length ? el.lines : wrapText(el, approxMeasure(el));
}

export function textHeight(el, lines = textLines(el)) {
  return Math.max(1, lines.length) * el.fontSize * el.lineHeight;
}

/** Baseline y (relative to element top) for line i. */
export function lineBaseline(el, i) {
  const lh = el.fontSize * el.lineHeight;
  return i * lh + (lh - el.fontSize) / 2 + el.fontSize * 0.8;
}

// ---------- Shapes ----------

export function shapePoints(el) {
  const { w, h } = el;
  switch (el.shape) {
    case 'triangle':
      return [[w / 2, 0], [w, h], [0, h]];
    case 'diamond':
      return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
    case 'hexagon':
      return [[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]];
    case 'star': {
      const n = el.points || 5;
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.21;
        const a = (Math.PI * i) / n - Math.PI / 2;
        pts.push([w / 2 + Math.cos(a) * r * w, h / 2 + Math.sin(a) * r * h + h * 0.04]);
      }
      return pts;
    }
    case 'arrow':
      return [[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]];
    case 'speech':
      return [[0, 0], [w, 0], [w, h * 0.75], [w * 0.4, h * 0.75], [w * 0.2, h], [w * 0.22, h * 0.75], [0, h * 0.75]];
    default:
      return null;
  }
}

/** A photo frame shape as an SVG path in the element's own box (0..w, 0..h), or null for none. */
export function maskPath(mask, w, h) {
  switch (mask) {
    case 'circle': return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z`;
    case 'heart': return HEART_PATH(w, h);
    case 'arch': { const r = Math.min(w / 2, h); return `M0 ${h}L0 ${r}A${w / 2} ${r} 0 0 1 ${w} ${r}L${w} ${h}Z`; }
    case 'blob': return `M${w * 0.52} ${h * 0.02}C${w * 0.78} ${h * 0.0} ${w * 0.98} ${h * 0.2} ${w * 0.97} ${h * 0.47}C${w * 0.96} ${h * 0.75} ${w * 0.8} ${h * 0.98} ${w * 0.5} ${h * 0.97}C${w * 0.2} ${h * 0.96} ${w * 0.02} ${h * 0.78} ${w * 0.03} ${h * 0.5}C${w * 0.04} ${h * 0.22} ${w * 0.27} ${h * 0.04} ${w * 0.52} ${h * 0.02}Z`;
    case 'triangle': case 'diamond': case 'hexagon': case 'star': {
      const pts = shapePoints({ shape: mask, w, h, points: 5 });
      return `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
    }
    default: return null;
  }
}
export const MASKS = [['', 'None'], ['circle', '●'], ['arch', '⌓'], ['blob', '☁'], ['heart', '♥'], ['star', '★'], ['hexagon', '⬢'], ['diamond', '◆'], ['triangle', '▲']];

export const HEART_PATH = (w, h) =>
  `M ${w / 2} ${h * 0.95} C ${w * 0.05} ${h * 0.6}, ${-w * 0.05} ${h * 0.15}, ${w * 0.27} ${h * 0.05} C ${w * 0.42} 0, ${w / 2} ${h * 0.12}, ${w / 2} ${h * 0.2} C ${w / 2} ${h * 0.12}, ${w * 0.58} 0, ${w * 0.73} ${h * 0.05} C ${w * 1.05} ${h * 0.15}, ${w * 0.95} ${h * 0.6}, ${w / 2} ${h * 0.95} Z`;

export function filterCss(f = {}) {
  const parts = [];
  if (f.brightness != null && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast != null && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate != null && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) parts.push(`sepia(${f.sepia}%)`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur) parts.push(`blur(${f.blur}px)`);
  return parts.join(' ') || 'none';
}

/** Scale a page made for (fw, fh) to fit (tw, th). */
export function scalePage(page, fw, fh, tw, th) {
  const sx = tw / fw;
  const sy = th / fh;
  const s = Math.min(sx, sy);
  const ox = (tw - fw * s) / 2;
  const oy = (th - fh * s) / 2;
  return {
    ...page,
    id: uid(),
    elements: page.elements.map((el) => {
      const out = { ...el, id: uid(), x: el.x * s + ox, y: el.y * s + oy, w: el.w * s, h: el.h * s };
      if (el.type === 'text') { out.fontSize = el.fontSize * s; out.letterSpacing = (el.letterSpacing || 0) * s; delete out.lines; }
      if (el.strokeWidth) out.strokeWidth = el.strokeWidth * s;
      if (el.radius) out.radius = el.radius * s;
      return out;
    }),
  };
}

/**
 * Magic resize: rearrange a page for a different shape instead of just shrinking it.
 * Positions follow the page (left stays left, middle stays middle), sizes use the smaller scale so nothing is
 * squashed, things that spanned the page keep spanning it, and everything is kept inside the new page.
 */
export function smartResizePage(page, fw, fh, tw, th) {
  const sx = tw / fw, sy = th / fh, s = Math.min(sx, sy);
  return {
    ...page,
    id: uid(),
    elements: page.elements.map((el) => {
      const wide = el.w >= fw * 0.85, tall = el.h >= fh * 0.85;
      const cx = (el.x + el.w / 2) * sx, cy = (el.y + el.h / 2) * sy;
      let w = wide ? el.w * sx : el.w * s;
      let h = tall ? el.h * sy : el.h * s;
      if (el.type === 'image' && (wide || tall) && !(wide && tall)) { w = el.w * (wide ? sx : s); h = el.h * (tall ? sy : s); }
      const out = { ...el, id: uid(), w, h, x: cx - w / 2, y: cy - h / 2 };
      if (el.type === 'text') {
        out.fontSize = el.fontSize * s; out.letterSpacing = (el.letterSpacing || 0) * s; delete out.lines;
        if (el.w >= fw * 0.6) { out.w = Math.min(tw * 0.92, el.w * sx); out.x = cx - out.w / 2; }
      }
      if (el.strokeWidth) out.strokeWidth = el.strokeWidth * s;
      if (el.radius) out.radius = el.radius * s;
      // Keep it on the page.
      out.x = Math.max(-out.w * 0.1, Math.min(tw - out.w * 0.9, out.x));
      out.y = Math.max(-out.h * 0.1, Math.min(th - out.h * 0.9, out.y));
      return out;
    }),
  };
}

/** Make sure a design object loaded from anywhere has the right shape. */
export const DOC_SIZES = {
  letter: { name: 'Letter (8.5 × 11 in)', w: 816, h: 1056 },
  a4: { name: 'A4 (210 × 297 mm)', w: 794, h: 1123 },
  legal: { name: 'Legal (8.5 × 14 in)', w: 816, h: 1344 },
  a5: { name: 'A5 (148 × 210 mm)', w: 559, h: 794 },
};

export function blankDoc(size = 'letter', html = '<h1>Untitled document</h1><p>Start typing…</p>') {
  const s = DOC_SIZES[size] || DOC_SIZES.letter;
  return { kind: 'doc', width: s.w, height: s.h, html, page: { size, orientation: 'portrait', margin: 1 }, pages: [blankPage()], assets: [], fonts: [], googleFonts: [] };
}

const safeFamily = (f) => String(f || '').replace(/[^\w \-]/g, '').trim().slice(0, 60);

function normalizeFonts(d) {
  const fonts = Array.isArray(d?.fonts)
    ? d.fonts.filter((f) => f && typeof f.src === 'string' && (f.src.startsWith('data:') || /^\/api\/(blobs\/[a-f0-9]{64}|media\/[A-Za-z0-9_-]{8,40})$/.test(f.src))).slice(0, 10)
      .map((f) => ({ family: safeFamily(f.family) || 'Custom font', src: f.src }))
    : [];
  const googleFonts = Array.isArray(d?.googleFonts) ? [...new Set(d.googleFonts.map(safeFamily).filter(Boolean))].slice(0, 20) : [];
  return { fonts, googleFonts };
}

export function normalizeDesign(d) {
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
  if (d?.kind === 'sheet') {
    return { kind: 'sheet', width: 1200, height: 800, sheets: normalizeSheets(d.sheets), pages: [], assets: [] };
  }
  if (d?.kind === 'doc') {
    const size = DOC_SIZES[d.page?.size] ? d.page.size : 'letter';
    const land = d.page?.orientation === 'landscape';
    const s = DOC_SIZES[size];
    return {
      kind: 'doc',
      width: land ? s.h : s.w,
      height: land ? s.w : s.h,
      html: typeof d.html === 'string' ? d.html.slice(0, 3_500_000) : '',
      page: { size, orientation: land ? 'landscape' : 'portrait', margin: Math.min(2.5, Math.max(0.25, Number(d.page?.margin) || 1)) },
      pages: [blankPage()],
      assets: [],
      ...normalizeFonts(d),
    };
  }
  const width = Math.round(Math.min(8000, Math.max(16, Number(d?.width) || 1080)));
  const height = Math.round(Math.min(8000, Math.max(16, Number(d?.height) || 1080)));
  const pages = Array.isArray(d?.pages) && d.pages.length ? d.pages.slice(0, 100) : [blankPage()];
  const kind = ['video', 'whiteboard', 'website'].includes(d?.kind) ? d.kind : undefined;
  const out = {
    width,
    height,
    pages: pages.map((p) => {
      const page = {
        id: p.id || uid(),
        background: p.background || { type: 'color', color: '#ffffff' },
        elements: Array.isArray(p.elements) ? p.elements.filter((e) => e && e.type) : [],
        notes: typeof p.notes === 'string' ? p.notes : '',
      };
      if (kind === 'video') {
        page.duration = Math.min(60, Math.max(0.5, Number(p.duration) || 3));
        page.transition = TRANSITIONS.includes(p.transition) ? p.transition : 'fade';
      } else if (TRANSITIONS.includes(p.transition) && p.transition !== 'none') {
        page.transition = p.transition; // presentations: how this slide comes in when presenting
      }
      if (kind === 'website' && typeof p.anchor === 'string') page.anchor = p.anchor.replace(/[^\w-]/g, '').slice(0, 40);
      return page;
    }),
    assets: Array.isArray(d?.assets) ? d.assets.slice(0, 200) : [],
    ...normalizeFonts(d),
  };
  if (kind) out.kind = kind;
  if (d?.textDefaults && typeof d.textDefaults === 'object') {
    const t = d.textDefaults;
    const td = {};
    if (safeFamily(t.font)) td.font = safeFamily(t.font);
    if (safeFamily(t.headingFont)) td.headingFont = safeFamily(t.headingFont);
    if (/^#[0-9a-f]{6}$/i.test(t.color || '')) td.color = t.color;
    if (Object.keys(td).length) out.textDefaults = td;
  }
  const mediaUrl = (u) => typeof u === 'string' && /^\/api\/media\/[A-Za-z0-9_-]{8,40}$/.test(u);
  if (kind === 'video' && d.audio && typeof d.audio.src === 'string' && ((/^data:audio\//.test(d.audio.src) && d.audio.src.length < 3_500_000) || mediaUrl(d.audio.src) || /^\/api\/blobs\/[a-f0-9]{64}$/.test(d.audio.src))) {
    out.audio = { src: d.audio.src, name: String(d.audio.name || 'Music').slice(0, 80), volume: Math.min(1, Math.max(0, Number(d.audio.volume ?? 0.8))) };
  }
  if (kind === 'video' && d.voiceover && mediaUrl(d.voiceover.src)) {
    out.voiceover = {
      src: d.voiceover.src, name: String(d.voiceover.name || 'Voiceover').slice(0, 80),
      start: Math.max(0, Number(d.voiceover.start) || 0), duration: Math.max(0, Number(d.voiceover.duration) || 0),
      volume: Math.min(1, Math.max(0, Number(d.voiceover.volume ?? 1))),
    };
  }
  // Video and sound elements may only play files uploaded here.
  for (const pg of out.pages) {
    pg.elements = pg.elements.filter((e) => (e.type !== 'video' && e.type !== 'audio') || mediaUrl(e.src));
    for (const e of pg.elements) if (e.type === 'video' && !(typeof e.poster === 'string' && ((/^data:image\/(jpeg|png|webp);/.test(e.poster) && e.poster.length < 400_000) || /^\/api\/blobs\/[a-f0-9]{64}$/.test(e.poster)))) e.poster = '';
  }
  // Guide lines you dragged out of the rulers.
  if (d?.guides && typeof d.guides === 'object') {
    const clean = (a) => (Array.isArray(a) ? a.map(Number).filter((v) => Number.isFinite(v)).slice(0, 40) : []);
    const gx = clean(d.guides.x), gy = clean(d.guides.y);
    if (gx.length || gy.length) out.guides = { x: gx, y: gy };
  }
  if (kind === 'website') out.site = { title: String(d.site?.title || '').slice(0, 120), nav: d.site?.nav !== false };
  return out;
}

// ---------- Video ----------
export const TRANSITIONS = ['none', 'fade', 'slide', 'push', 'zoom', 'wipe'];
export const TRANSITION_NAMES = { none: 'None (cut)', fade: 'Fade', slide: 'Slide', push: 'Push up', zoom: 'Zoom', wipe: 'Wipe' };
export const ANIMATIONS = [
  ['none', 'None'], ['fade', 'Fade in'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide in from right'],
  ['slide-right', 'Slide in from left'], ['zoom', 'Zoom in'], ['pop', 'Pop'], ['spin', 'Spin in'], ['drop', 'Drop in'], ['typewriter', 'Typewriter (text)'],
];

export function videoLength(design) {
  return (design.pages || []).reduce((t, p) => t + (Number(p.duration) || 3), 0);
}

export function blankVideo(w = 1920, h = 1080, scenes = 3) {
  return {
    kind: 'video', width: w, height: h, assets: [], fonts: [], googleFonts: [],
    pages: Array.from({ length: scenes }, () => ({ ...blankPage('#111317'), duration: 3, transition: 'fade' })),
  };
}

export const GRADIENTS = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'], ['#30cfd0', '#330867'], ['#a8edea', '#fed6e3'], ['#ff9a9e', '#fecfef'],
  ['#0f2027', '#2c5364'], ['#f6d365', '#fda085'], ['#3ddc84', '#1f9d5a'], ['#16181d', '#1f9d5a'], ['#7c3aed', '#06b6d4'], ['#000000', '#434343'],
];

export const SWATCHES = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#111111', '#000000',
  '#fef3c7', '#fde68a', '#facc15', '#f97316', '#ef4444', '#be123c', '#ec4899',
  '#f5d0fe', '#c084fc', '#7c3aed', '#4338ca', '#155dfc', '#0ea5e9', '#06b6d4',
  '#e2f4ea', '#3ddc84', '#1f9d5a', '#188049', '#84cc16', '#a16207', '#78350f',
];

export const EMOJI = [
  '😀', '😍', '🥳', '😎', '🤩', '🔥', '✨', '⭐', '🌟', '💖', '💜', '💙', '💚', '🧡', '👍', '👏', '🙌', '🎉',
  '🎈', '🎁', '🎂', '🍕', '☕', '🌈', '☀️', '🌙', '⚡', '🌸', '🌻', '🍀', '🌊', '🏔️', '🚀', '✈️', '🎵', '🎮',
  '📷', '💡', '📌', '✅', '❌', '➡️', '⬆️', '💬', '📣', '🏆', '💎', '👑', '🐶', '🐱', '🦄', '🍔', '🍩', '⚽',
];
