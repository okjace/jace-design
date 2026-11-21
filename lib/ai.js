'use client';
// "Bring your own AI": we build a prompt, you paste it into any AI, then paste its answer back.
import { FONTS, normalizeDesign, uid } from './design';
import { ALL_LIBRARY_FONTS } from './fontLibrary';
import { cleanHtml, markdownToHtml } from './htmlClean';
import { fileToDataUrl } from './export';

export const AIS = [
  { name: 'ChatGPT', url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`, home: 'https://chatgpt.com/' },
  { name: 'Claude', url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`, home: 'https://claude.ai/new' },
  { name: 'Gemini', url: null, home: 'https://gemini.google.com/app' },
  { name: 'Copilot', url: (p) => `https://copilot.microsoft.com/?q=${encodeURIComponent(p)}`, home: 'https://copilot.microsoft.com/' },
  { name: 'Grok', url: (p) => `https://grok.com/?q=${encodeURIComponent(p)}`, home: 'https://grok.com/' },
  { name: 'Perplexity', url: (p) => `https://www.perplexity.ai/search?q=${encodeURIComponent(p)}`, home: 'https://www.perplexity.ai/' },
];

const ELEMENT_GUIDE = `Coordinates are in pixels from the top-left of the page. Every element needs "type", "x", "y", "w", "h". Later elements are drawn on top.

Options every element can have (all optional):
"rotation": degrees, "opacity": 0-1, "blend": "normal"|"multiply"|"screen"|"overlay"|"darken"|"lighten"|"soft-light"|"difference",
"shadow": {"on":true,"x":6,"y":10,"blur":20,"color":"rgba(0,0,0,0.35)"}

Element types:
- TEXT: {"type":"text","text":"Line one\\nLine two","x":0,"y":0,"w":600,"h":80,"fontFamily":"Poppins","fontSize":64,
  "fontWeight":100-900 (400 normal, 700 bold),"italic":false,"underline":false,"uppercase":false,"align":"left"|"center"|"right",
  "color":"#111111","lineHeight":1.2,"letterSpacing":0,
  "strokeWidth":0,"stroke":"#000000" (outline around letters),"bgColor":"#fde047" (highlight behind the text, optional)}
- SHAPE: {"type":"shape","shape":"rect"|"ellipse"|"triangle"|"star"|"heart"|"hexagon"|"diamond"|"arrow"|"speech","x":0,"y":0,"w":200,"h":200,
  "fill":"#1f9d5a" ("" for no fill),"gradient":"#second color (optional)","gradientAngle":135,
  "stroke":"#000000","strokeWidth":0,"borderStyle":"solid"|"dashed"|"dotted","radius":0 (rounded corners for rect),"points":5 (for star)}
- LINE: {"type":"line","x":0,"y":0,"w":300,"h":10,"stroke":"#111111","strokeWidth":6,"dash":false,"arrow":false}
- PHOTO: {"type":"image","query":"2-4 word photo search, e.g. 'mountain sunrise'","x":0,"y":0,"w":500,"h":400,"radius":0,
  "fit":"cover"|"contain","focus":"xMidYMid" (or xMinYMin, xMaxYMax, …),"flipX":false,
  "filters":{"brightness":100,"contrast":100,"saturate":100,"grayscale":0,"sepia":0,"blur":0}}
  A real free photo matching "query" is found and placed automatically.

Page background, pick one:
- {"type":"color","color":"#ffffff"}
- {"type":"gradient","from":"#hex","to":"#hex","angle":135}
- {"type":"image","query":"photo search words","opacity":1,"color":"#000000","filters":{"brightness":70}} (a full-page photo; lower brightness or opacity so text on top stays readable)

Pages may also have "notes": "speaker notes for this page".

Fonts: you can use ANY Google Font by its exact name. Good choices: ${[...new Set([...FONTS, ...ALL_LIBRARY_FONTS])].slice(0, 120).join(', ')}.
Emoji are fine inside text elements.`;

const RULES = `Reply with ONLY one JSON code block, no explanation. Keep everything inside the page, make text big enough to read, use strong contrast, leave margins, and make it look professionally designed.`;

export function buildPrompt(mode, { idea, width, height, pages = 1, title, text, html, design } = {}) {
  const w = Math.round(width || 1080);
  const h = Math.round(height || 1080);
  switch (mode) {
    case 'design':
    case 'template':
      return `You are a world-class graphic designer. Design a ${w}x${h} pixel ${pages > 1 ? `${pages}-page ` : ''}design for this idea:

"${idea}"

Return JSON shaped like:
{"title":"short title","width":${w},"height":${h},"pages":[{"background":{...},"elements":[...]}]}

${ELEMENT_GUIDE}

${RULES}`;
    case 'pages':
      return `You are a world-class graphic designer. Add ${pages} new page(s) to a ${w}x${h} pixel design titled "${title || 'Untitled'}". New pages should be about:

"${idea}"

Return JSON shaped like: {"pages":[{"background":{...},"elements":[...]}]}

${ELEMENT_GUIDE}

${RULES}`;
    case 'redo':
      return `You are a world-class graphic designer. Redesign this whole ${w}x${h} pixel design (all ${design?.pages?.length || 1} pages). ${idea ? `What I want: "${idea}"` : 'Make it look far more professional while keeping the same content and message.'}
You may change fonts, colors, backgrounds, layout and add photos or shapes.

Current design JSON:
${JSON.stringify({ pages: (design?.pages || []).map(stripPage) }, null, 0)}

Return JSON shaped like: {"pages":[{"background":{...},"elements":[...]}]} with the same number of pages unless I asked otherwise.

${ELEMENT_GUIDE}

${RULES}`;
    case 'page':
      return `You are a world-class graphic designer. Redesign this ${w}x${h} pixel page. ${idea ? `What I want: "${idea}"` : 'Make it look much better while keeping the same message.'}

Current page JSON:
${JSON.stringify(stripPage(design), null, 0)}

Return JSON shaped like: {"pages":[{"background":{...},"elements":[...]}]} with exactly one page.

${ELEMENT_GUIDE}

${RULES}`;
    case 'text':
      return `Rewrite this text. ${idea ? `Instructions: ${idea}.` : 'Make it clearer and more engaging, about the same length.'}

Text:
"""${text}"""

Reply with ONLY the new text, nothing else.`;
    case 'palette':
      return `Suggest a color palette of 5 colors for a design about: "${idea || title || 'a modern brand'}".
Reply with ONLY a JSON code block like {"colors":["#112233","#445566","#778899","#aabbcc","#ddeeff"]} ordered from background to accent.`;
    case 'doc':
      return `Write a document: "${idea}".
Use Markdown: # for the title, ## and ### for headings, normal paragraphs, - bullet lists, 1. numbered lists, **bold**, *italic*, > quotes and | tables | when useful.
Reply with ONLY the document in Markdown.`;
    case 'doc-edit':
      return `Edit this part of a document. ${idea ? `Instructions: ${idea}.` : 'Improve the writing.'}

"""${text}"""

Reply with ONLY the new text in Markdown, nothing else.`;
    default:
      return idea || '';
  }
}

function stripPage(page) {
  if (!page) return {};
  return {
    background: page.background?.type === 'image' ? { type: 'color', color: '#ffffff' } : page.background,
    elements: (page.elements || []).map((e) => {
      const { id, lines, locked, hidden, src, filters, ...rest } = e;
      if (e.type === 'image') return { type: 'image', query: 'photo', x: e.x, y: e.y, w: e.w, h: e.h, radius: e.radius || 0 };
      return rest;
    }),
  };
}

/** Pull JSON out of an AI reply (code fences, extra words, trailing commas). */
export function extractJson(reply) {
  let s = String(reply || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1];
  const a = Math.min(...['{', '['].map((c) => { const i = s.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (a === Infinity || b < a) throw new Error("Couldn't find any JSON in that reply. Make sure you pasted the AI's whole answer.");
  s = s.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`The AI's answer isn't valid JSON (${e.message}). Ask it to "reply with only valid JSON" and try again.`);
  }
}

export function stripFences(reply) {
  const s = String(reply || '').trim();
  const fence = s.match(/^```[\w-]*\s*([\s\S]*?)```$/);
  return (fence ? fence[1] : s).trim().replace(/^"""|"""$/g, '').trim();
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const color = (v, d) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]{3,20})$/i.test(v.trim()) ? v.trim() : d);

const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const fontName = (f) => (typeof f === 'string' ? f.replace(/[^\w \-]/g, '').trim().slice(0, 60) : '');
const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, num(v, d)));

function cleanFilters(f) {
  if (!f || typeof f !== 'object') return {};
  return {
    brightness: clamp(f.brightness, 0, 200, 100), contrast: clamp(f.contrast, 0, 200, 100), saturate: clamp(f.saturate, 0, 300, 100),
    grayscale: clamp(f.grayscale, 0, 100, 0), sepia: clamp(f.sepia, 0, 100, 0), hue: clamp(f.hue, 0, 360, 0), blur: clamp(f.blur, 0, 30, 0),
  };
}

function cleanEl(e, W, H) {
  if (!e || typeof e !== 'object') return null;
  const base = {
    id: uid(), rotation: num(e.rotation), opacity: clamp(e.opacity, 0, 1, 1), locked: false, hidden: false,
    x: num(e.x), y: num(e.y), w: Math.max(4, num(e.w, W / 3)), h: Math.max(2, num(e.h, H / 6)),
  };
  if (BLENDS.includes(e.blend) && e.blend !== 'normal') base.blend = e.blend;
  if (e.shadow && typeof e.shadow === 'object' && e.shadow.on !== false) {
    base.shadow = { on: true, x: num(e.shadow.x, 6), y: num(e.shadow.y, 10), blur: clamp(e.shadow.blur, 0, 200, 20), color: color(e.shadow.color, 'rgba(0,0,0,0.35)') };
  }
  if (e.type === 'text') {
    return {
      ...base, type: 'text', text: String(e.text ?? '').slice(0, 3000),
      fontFamily: fontName(e.fontFamily) || 'Inter', fontSize: Math.max(4, num(e.fontSize, 40)),
      fontWeight: Math.round(clamp(e.fontWeight, 100, 900, 400) / 100) * 100, italic: !!e.italic, underline: !!e.underline, uppercase: !!e.uppercase,
      align: ['left', 'center', 'right'].includes(e.align) ? e.align : 'left', color: color(e.color, '#111111'),
      lineHeight: clamp(e.lineHeight, 0.6, 3, 1.2), letterSpacing: num(e.letterSpacing),
      strokeWidth: Math.max(0, num(e.strokeWidth)), stroke: color(e.stroke, '#000000'), bgColor: e.bgColor ? color(e.bgColor, '') : '',
    };
  }
  if (e.type === 'shape') {
    const shapes = ['rect', 'ellipse', 'triangle', 'star', 'heart', 'hexagon', 'diamond', 'arrow', 'speech'];
    return {
      ...base, type: 'shape', shape: shapes.includes(e.shape) ? e.shape : 'rect', fill: e.fill === '' || e.fill === 'none' ? '' : color(e.fill, '#1f9d5a'),
      gradient: e.gradient ? color(e.gradient, '') : '', gradientAngle: num(e.gradientAngle, 135),
      stroke: color(e.stroke, '#000000'), strokeWidth: Math.max(0, num(e.strokeWidth)),
      borderStyle: ['solid', 'dashed', 'dotted'].includes(e.borderStyle) ? e.borderStyle : 'solid',
      radius: Math.max(0, num(e.radius)), points: clamp(e.points, 3, 12, 5),
    };
  }
  if (e.type === 'line') {
    return { ...base, type: 'line', stroke: color(e.stroke, '#111111'), strokeWidth: Math.max(1, num(e.strokeWidth, 6)), dash: !!e.dash, arrow: !!e.arrow };
  }
  if (e.type === 'image') {
    return {
      ...base, type: 'image', src: '', query: String(e.query || e.alt || 'abstract background').slice(0, 80), radius: Math.max(0, num(e.radius)),
      fit: e.fit === 'contain' ? 'contain' : 'cover', focus: /^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(e.focus || '') ? e.focus : 'xMidYMid',
      flipX: !!e.flipX, flipY: !!e.flipY, filters: cleanFilters(e.filters),
    };
  }
  return null;
}

function cleanBg(bg) {
  if (bg?.type === 'gradient') return { type: 'gradient', from: color(bg.from, '#1f9d5a'), to: color(bg.to, '#0d5c36'), angle: num(bg.angle, 135) };
  if (bg?.type === 'image' && (bg.query || bg.search)) {
    return { type: 'image', src: '', query: String(bg.query || bg.search).slice(0, 80), opacity: clamp(bg.opacity, 0, 1, 1), color: color(bg.color, '#000000'), filters: cleanFilters(bg.filters) };
  }
  return { type: 'color', color: color(bg?.color, '#ffffff') };
}

/** Fonts used in some pages that aren't built in (so they can be added to the design and loaded). */
export function extraFonts(pages) {
  return [...new Set(pages.flatMap((p) => p.elements).filter((e) => e.type === 'text').map((e) => e.fontFamily))].filter((f) => f && !FONTS.includes(f));
}

/** Turn an AI reply into pages for a W×H design (scaled if the AI used a different size). */
export function aiToPages(data, W, H) {
  const pages = Array.isArray(data) ? data : Array.isArray(data?.pages) ? data.pages : data?.elements ? [data] : [];
  if (!pages.length) throw new Error('The reply has no pages in it.');
  const aw = num(data?.width, W) || W;
  const ah = num(data?.height, H) || H;
  const s = Math.min(W / aw, H / ah);
  return pages.slice(0, 30).map((p) => ({
    id: uid(),
    background: cleanBg(p.background),
    notes: typeof p.notes === 'string' ? p.notes.slice(0, 2000) : '',
    elements: (Array.isArray(p.elements) ? p.elements : []).slice(0, 80).map((e) => cleanEl(e, aw, ah)).filter(Boolean).map((e) => {
      if (s === 1) return e;
      const o = { ...e, x: e.x * s, y: e.y * s, w: e.w * s, h: e.h * s };
      if (o.fontSize) o.fontSize *= s;
      if (o.strokeWidth) o.strokeWidth *= s;
      if (o.radius) o.radius *= s;
      return o;
    }),
  }));
}

export function aiToDesign(data, fallbackW, fallbackH) {
  const W = Math.round(Math.min(8000, Math.max(16, num(data?.width, fallbackW))));
  const H = Math.round(Math.min(8000, Math.max(16, num(data?.height, fallbackH))));
  const pages = aiToPages({ ...data, width: W, height: H }, W, H);
  return {
    title: typeof data?.title === 'string' ? data.title.slice(0, 120) : '',
    design: normalizeDesign({ width: W, height: H, pages, assets: [], googleFonts: extraFonts(pages) }),
  };
}

export function aiToPalette(data) {
  const list = Array.isArray(data) ? data : data?.colors || data?.palette || [];
  const colors = list.map((c) => color(typeof c === 'string' ? c : c?.hex, null)).filter(Boolean).slice(0, 8);
  if (!colors.length) throw new Error('No colors found in that reply.');
  return colors;
}

export function aiToDocHtml(reply) {
  const s = stripFences(reply);
  return cleanHtml(/<\/?(p|h[1-6]|ul|ol|table|div)\b/i.test(s) ? s : markdownToHtml(s));
}

/** Fill image placeholders (elements with a `query`) with free photos from the image search. */
async function findPhoto(query, used, max = 1400) {
  const r = await fetch(`/api/images/search?q=${encodeURIComponent(query)}`);
  const { results = [] } = await r.json();
  const pick = results.find((x) => !used.has(x.id) && x.width && x.height) || results[0];
  if (!pick) throw new Error('none');
  used.add(pick.id);
  const blob = await (await fetch(`/api/images/${pick.id}`)).blob();
  const { src } = await fileToDataUrl(blob, max);
  return { src, credit: `${pick.title || 'Photo'}${pick.creator ? ` by ${pick.creator}` : ''} (${pick.license})` };
}

export async function fillAiImages(pages, onProgress) {
  const used = new Set();
  for (const p of pages) {
    // Full-page background photo.
    if (p.background?.type === 'image' && !p.background.src && p.background.query) {
      onProgress?.(`Finding a background for “${p.background.query}”…`);
      try {
        const { src } = await findPhoto(p.background.query, used, 1800);
        const { query, ...bg } = p.background;
        p.background = { ...bg, src };
      } catch {
        p.background = { type: 'color', color: p.background.color && p.background.color !== '#000000' ? p.background.color : '#16181d' };
      }
    }
    for (let i = 0; i < p.elements.length; i++) {
      const e = p.elements[i];
      if (e.type !== 'image' || e.src || !e.query) continue;
      onProgress?.(`Finding a photo for “${e.query}”…`);
      try {
        const r = await fetch(`/api/images/search?q=${encodeURIComponent(e.query)}`);
        const { results = [] } = await r.json();
        const pick = results.find((x) => !used.has(x.id) && x.width && x.height) || results[0];
        if (!pick) throw new Error('none');
        used.add(pick.id);
        const blob = await (await fetch(`/api/images/${pick.id}`)).blob();
        const { src } = await fileToDataUrl(blob, 1400);
        const { query, ...rest } = e;
        p.elements[i] = { ...rest, src, credit: `${pick.title || 'Photo'}${pick.creator ? ` by ${pick.creator}` : ''} (${pick.license})` };
      } catch {
        p.elements[i] = { id: e.id, type: 'shape', shape: 'rect', x: e.x, y: e.y, w: e.w, h: e.h, fill: '#dfe2e7', stroke: '#000000', strokeWidth: 0, radius: e.radius || 0, rotation: e.rotation || 0, opacity: 1, locked: false, hidden: false };
      }
    }
  }
  return pages;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
