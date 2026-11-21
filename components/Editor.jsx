'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DesignPage from './DesignPage';
import Presenter from './Presenter';
import ShareModal from './ShareModal';
import AiHelper from './AiHelper';
import ImageSearch from './ImageSearch';
import ContextMenu from './ContextMenu';
import SaveTemplate from './SaveTemplate';
import { AccessLost, useAccessWatch } from './AccessWatch';
import { useSaver } from './useSaver';
import VideoPlayer from './VideoPlayer';
import LinkPicker, { linkLabel, sectionAnchor } from './LinkPicker';
import IconSearch, { iconDataUrl } from './IconSearch';
import BrandKit, { useBrand } from './BrandKit';
import VersionHistory from './VersionHistory';
import Timeline from './Timeline';
import { LiveLayer, useLive } from './LiveCursors';
import { CHART_COLORS, CHART_TYPES, audioEl, chartEl, chartToCsv, clipLength, csvToChart, qrEl, resolveBg, tableEl, videoEl } from '@/lib/blocks';
import { audioDuration, uploadMedia, videoInfo } from '@/lib/media';
import {
  EMOJI, FONTS, GRADIENTS, PRESET_GROUPS, SWATCHES, blankPage, emojiEl, imageEl, lineEl, normalizeDesign,
  scalePage, shapeEl, textEl, textFont, textHeight, uid, wrapText, ANIMATIONS, videoLength, TRANSITIONS, TRANSITION_NAMES,
} from '@/lib/design';
import { TEMPLATES, templateDesign } from '@/lib/templates';
import { ensureFonts, exportImage, exportJson, exportPdf, exportSvg, fileToDataUrl, renderPageToCanvas } from '@/lib/export';
import { fontFileToDataUrl, loadFontFile, loadGoogleFont, registerFonts } from '@/lib/fonts';
import { aiToPages, aiToPalette, extraFonts, extractJson, fillAiImages, stripFences } from '@/lib/ai';

const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const FOCUS = [['xMinYMin', '↖'], ['xMidYMin', '↑'], ['xMaxYMin', '↗'], ['xMinYMid', '←'], ['xMidYMid', '•'], ['xMaxYMid', '→'], ['xMinYMax', '↙'], ['xMidYMax', '↓'], ['xMaxYMax', '↘']];

/** Every color used in the design, most-used first (for quick reuse). */
function designColors(design) {
  const count = new Map();
  const add = (c) => { if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) count.set(c.toLowerCase(), (count.get(c.toLowerCase()) || 0) + 1); };
  for (const p of design.pages) {
    add(p.background?.color); add(p.background?.from); add(p.background?.to);
    for (const e of p.elements) { add(e.color); add(e.fill); add(e.gradient); add(e.stroke); add(e.bgColor); }
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 14);
}

// ---------- text measuring ----------
let measureCtx = null;
function measureText(el) {
  if (typeof document === 'undefined') return el;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = textFont(el);
  if ('letterSpacing' in measureCtx) measureCtx.letterSpacing = `${el.letterSpacing || 0}px`;
  const lines = wrapText(el, (s) => measureCtx.measureText(s).width);
  return { ...el, lines, h: textHeight(el, lines) };
}
const fixEl = (el) => (el.type === 'text' ? measureText(el) : el);

const RAIL = [
  ['templates', '🧩', 'Templates'],
  ['ai', '✨', 'AI'],
  ['elements', '🔷', 'Elements'],
  ['icons', '⭐', 'Icons'],
  ['text', '🔤', 'Text'],
  ['photos', '🔍', 'Photos'],
  ['uploads', '☁️', 'Uploads'],
  ['background', '🎨', 'Background'],
  ['brand', '💼', 'Brand'],
  ['layers', '📚', 'Layers'],
];

const SHAPES = [
  ['rect', {}], ['rect', { radius: 40 }], ['ellipse', {}], ['triangle', {}], ['star', {}], ['heart', {}],
  ['hexagon', {}], ['diamond', {}], ['arrow', { h: 120 }], ['speech', {}], ['rect', { fill: '', stroke: '#111111', strokeWidth: 8 }], ['ellipse', { fill: '', stroke: '#111111', strokeWidth: 8 }],
];

const FONT_COMBOS = [
  ['Bebas Neue', 'Inter', 'BOLD STATEMENT', 'Clean supporting text'],
  ['Playfair Display', 'Lora', 'Elegant Title', 'A refined subtitle'],
  ['Poppins', 'Inter', 'Modern Heading', 'Friendly body copy'],
  ['Pacifico', 'Montserrat', 'Hello there', 'SAY IT WITH STYLE'],
  ['Archivo Black', 'Space Grotesk', 'LOUD & PROUD', 'Techy little subtitle'],
  ['Dancing Script', 'Raleway', 'With love', 'Handwritten charm'],
];

const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

function Num({ label, value, onChange, step = 1, min, max }) {
  return (
    <label>
      {label}
      <input type="number" step={step} min={min} max={max} value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
        onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

function Range({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '' }) {
  return (
    <div className="range-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{Math.round(value * 100) / 100}{suffix}</span>
    </div>
  );
}

function ColorRow({ label, value, onChange, colors }) {
  const v = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return (
    <div>
      <div className="color-row">
        <input type="color" value={v} onChange={(e) => onChange(e.target.value)} />
        <span className="grow">{label}</span>
        <input className="input" style={{ width: 92, padding: '5px 8px', fontSize: 12 }} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
      {colors?.length ? (
        <div className="mini-swatches">
          {colors.map((c) => <button key={c} title={c} style={{ background: c }} onClick={() => onChange(c)} />)}
        </div>
      ) : null}
    </div>
  );
}

export default function Editor({ id, initialDesign, initialTitle, initialVisibility, role, version }) {
  const [design, setDesign] = useState(() => normalizeDesign(initialDesign));
  const designRef = useRef(design);
  const past = useRef([]);
  const future = useRef([]);
  const [, force] = useState(0);
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [pageIdx, setPageIdx] = useState(0);
  const [selId, setSelId] = useState(null);
  const [multi, setMulti] = useState([]); // several selected elements (ids)
  const [marquee, setMarquee] = useState(null); // the box being dragged to select
  const [editingId, setEditingId] = useState(null);
  const [panel, setPanel] = useState('templates');
  const [zoom, setZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);
  const [modal, setModal] = useState(null); // 'share' | 'download' | 'resize' | 'present'
  const [guides, setGuides] = useState([]);
  const [busy, setBusy] = useState('');
  const [ai, setAi] = useState(null); // AI helper mode
  const [menu, setMenu] = useState(null); // right-click menu { x, y }
  const [fontMsg, setFontMsg] = useState('');
  const [gFont, setGFont] = useState('');
  const fontFileRef = useRef(null);
  const audioRef = useRef(null);
  const isVideo = design.kind === 'video';
  const isBoard = design.kind === 'whiteboard';
  const isSite = design.kind === 'website';
  const [pen, setPen] = useState(null); // { color, width } while the pen is on
  const [stroke, setStroke] = useState(null); // the line being drawn right now
  const [brand, saveBrand] = useBrand();
  const [live, setLive] = useState(false); // live cursors (off unless you turn it on)
  useEffect(() => { try { setLive(localStorage.getItem('jd_live') === '1'); } catch {} }, []);
  const toggleLive = () => setLive((v) => { try { localStorage.setItem('jd_live', v ? '0' : '1'); } catch {} return !v; });
  const posRef = useRef(null); // your cursor, in design units (for live cursors)
  const selRef = useRef(null);
  const remoteRef = useRef(false); // true while loading someone else's saved changes (don't save them back)
  const addSticky = (color) => addEl(textEl({ text: 'Write something…', fontFamily: 'Caveat', fontSize: 44 * k, w: 340 * k, color: '#16181d', bgColor: color, lineHeight: 1.25 }));

  async function addAudio(file) {
    setBusy('Uploading music… 0%');
    try {
      const src = await uploadMedia(file, { onProgress: (p) => setBusy(`Uploading music… ${Math.round(p * 100)}%`) });
      commit((d) => ({ ...d, audio: { src, name: file.name.slice(0, 80), volume: 0.8 } }));
    } catch (e) {
      alert(e.message || 'Could not add that music.');
    } finally {
      setBusy('');
    }
  }
  // If the owner removes you (or makes you view-only) while you're editing, stop saving and say so.
  const lockedOut = useRef(false);
  const { lost, setLost } = useAccessWatch(id, role, () => { lockedOut.current = true; clearTimeout(saveTimer.current); saver.stop(); });
  const scrollRef = useRef(null);
  const wrapRef = useRef(null);
  const clipRef = useRef(null);
  const uploadRef = useRef(null);
  const replaceRef = useRef(null);
  const saveTimer = useRef(null);
  const saving = useRef(false);
  const dirty = useRef(false);
  const titleRef = useRef(title);
  titleRef.current = title;

  const W = design.width;
  const H = design.height;
  const page = design.pages[Math.min(pageIdx, design.pages.length - 1)];
  const sel = page.elements.find((e) => e.id === selId) || null;
  selRef.current = selId;
  const k = Math.min(W, H) / 1080; // scale for default element sizes

  // ---------- state + history ----------
  const commit = useCallback((fn, { history = true } = {}) => {
    const prev = designRef.current;
    const next = typeof fn === 'function' ? fn(prev) : fn;
    if (next === prev) return;
    if (history) {
      past.current.push(prev);
      if (past.current.length > 150) past.current.shift();
      future.current = [];
    }
    designRef.current = next;
    setDesign(next);
  }, []);
  const snapshot = () => {
    past.current.push(designRef.current);
    if (past.current.length > 150) past.current.shift();
    future.current = [];
  };
  const undo = () => {
    if (!past.current.length) return;
    future.current.push(designRef.current);
    const d = past.current.pop();
    designRef.current = d; setDesign(d); force((x) => x + 1);
  };
  const redo = () => {
    if (!future.current.length) return;
    past.current.push(designRef.current);
    const d = future.current.pop();
    designRef.current = d; setDesign(d); force((x) => x + 1);
  };

  const pi = Math.min(pageIdx, design.pages.length - 1);
  const mapPage = (d, fn, index = pi) => ({ ...d, pages: d.pages.map((p, i) => (i === index ? fn(p) : p)) });
  const updateEl = (eid, patch, opts) =>
    commit((d) => mapPage(d, (p) => ({ ...p, elements: p.elements.map((e) => (e.id === eid ? fixEl({ ...e, ...(typeof patch === 'function' ? patch(e) : patch) }) : e)) })), opts);
  const updateSel = (patch, opts) => sel && updateEl(sel.id, patch, opts);
  const setBg = (bg) => commit((d) => mapPage(d, (p) => ({ ...p, background: bg })));

  function addEl(el, { center = true } = {}) {
    let e = { ...el };
    if (center) { e.x = (W - e.w) / 2; e.y = (H - e.h) / 2; }
    e = fixEl(e);
    if (center && e.type === 'text') e.y = (H - e.h) / 2;
    commit((d) => mapPage(d, (p) => ({ ...p, elements: [...p.elements, e] })));
    setSelId(e.id);
    if (e.type === 'text') loadFont(e);
    return e;
  }
  const deleteSel = () => {
    if (!sel) return;
    commit((d) => mapPage(d, (p) => ({ ...p, elements: p.elements.filter((e) => e.id !== sel.id) })));
    setSelId(null);
  };
  const duplicateSel = () => {
    if (!sel) return;
    const c = { ...sel, id: uid(), x: sel.x + 24 * k, y: sel.y + 24 * k, locked: false };
    commit((d) => mapPage(d, (p) => {
      const i = p.elements.findIndex((e) => e.id === sel.id);
      const els = [...p.elements];
      els.splice(i + 1, 0, c);
      return { ...p, elements: els };
    }));
    setSelId(c.id);
  };
  const reorder = (how) => {
    if (!sel) return;
    commit((d) => mapPage(d, (p) => {
      const els = [...p.elements];
      const i = els.findIndex((e) => e.id === sel.id);
      const [e] = els.splice(i, 1);
      const to = how === 'front' ? els.length : how === 'back' ? 0 : how === 'up' ? Math.min(els.length, i + 1) : Math.max(0, i - 1);
      els.splice(to, 0, e);
      return { ...p, elements: els };
    }));
  };
  const alignSel = (how) => {
    if (!sel) return;
    const p = { left: { x: 0 }, center: { x: (W - sel.w) / 2 }, right: { x: W - sel.w }, top: { y: 0 }, middle: { y: (H - sel.h) / 2 }, bottom: { y: H - sel.h } }[how];
    updateSel(p);
  };
  const colors = useMemo(() => [...new Set([...(brand?.colors || []), ...designColors(design)])].slice(0, 21), [design, brand]);
  const fontList = useMemo(
    () => [...new Set([...(design.fonts || []).map((f) => f.family), ...(design.googleFonts || []), ...FONTS])],
    [design.fonts, design.googleFonts]
  );

  // Make an image element the page background (keeps its filters).
  const toBackground = (el) => {
    if (!el || el.type !== 'image') return;
    commit((d) => mapPage(d, (p) => ({
      ...p,
      background: { type: 'image', src: el.src, color: '#ffffff', filters: el.filters, opacity: el.opacity ?? 1 },
      elements: p.elements.filter((e) => e.id !== el.id),
    })));
    setSelId(null);
  };
  const bgToImage = () => {
    const bg = page.background;
    if (bg?.type !== 'image') return;
    const e = imageEl({ src: bg.src, x: 0, y: 0, w: W, h: H, filters: bg.filters || {}, opacity: bg.opacity ?? 1 });
    commit((d) => mapPage(d, (p) => ({ ...p, background: { type: 'color', color: '#ffffff' }, elements: [e, ...p.elements] })));
    setSelId(e.id);
  };

  // ---------- default text settings ----------
  const td = design.textDefaults || {};
  const tdFont = (heading, fallback) => (heading ? td.headingFont || td.font : td.font) || fallback;
  const withDefaults = (el, heading) => {
    const f = heading ? td.headingFont || td.font : td.font;
    return { ...el, ...(f ? { fontFamily: f } : {}), ...(td.color && el.type !== 'chart' ? { color: td.color } : {}) };
  };
  async function ensureFontKnown(f) {
    const d = designRef.current;
    if (!f || FONTS.includes(f) || (d.fonts || []).some((x) => x.family === f) || (d.googleFonts || []).includes(f)) return;
    commit((x) => ({ ...x, googleFonts: [...new Set([...(x.googleFonts || []), f])] }), { history: false });
    await loadGoogleFont(f);
  }
  const setTd = (patch) => {
    commit((d) => ({ ...d, textDefaults: { ...(d.textDefaults || {}), ...patch } }));
    if (patch.font) ensureFontKnown(patch.font);
    if (patch.headingFont) ensureFontKnown(patch.headingFont);
  };
  function applyTd(scope) {
    const isHeading = (e) => (e.fontWeight || 400) >= 600 || e.fontSize >= 72 * k;
    commit((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (scope === 'page' && i !== pi ? p : {
        ...p,
        elements: p.elements.map((e) => {
          if (e.type === 'table' || e.type === 'chart') return { ...e, ...(td.font ? { fontFamily: td.font } : {}), ...(td.color ? { color: td.color } : {}) };
          if (e.type !== 'text') return e;
          const patch = {};
          const f = isHeading(e) ? td.headingFont || td.font : td.font;
          if (f) patch.fontFamily = f;
          if (td.color && !e.bgColor) patch.color = td.color; // buttons and sticky notes keep their colors
          return Object.keys(patch).length ? fixEl({ ...e, ...patch }) : e;
        }),
      })),
    }));
    [td.font, td.headingFont].filter(Boolean).forEach((f) => loadFont({ fontFamily: f, fontWeight: 400 }));
  }

  async function removeBackground(el) {
    if (el?.type !== 'image' || !el.src) return;
    try {
      const { removeBackground: run } = await import('@/lib/bgremove');
      const src = await run(el.src, setBusy);
      commit((d) => ({ ...d, assets: [{ id: uid(), src, width: el.w, height: el.h }, ...(d.assets || [])] }), { history: false });
      updateEl(el.id, { src, filters: el.filters });
    } catch (e) {
      alert(`Couldn't remove the background: ${e.message || e}. It works best in an up-to-date Chrome, Edge or the desktop app.`);
    } finally {
      setBusy('');
    }
  }

  // Icons are drawings fetched in one color; changing the color fetches it again in the new one.
  const iconSeq = useRef(0);
  async function recolorIcon(el, c) {
    if (!el?.icon || !/^#[0-9a-f]{6}$/i.test(c)) return;
    const n = ++iconSeq.current;
    try {
      const src = await iconDataUrl(el.icon, c);
      if (n === iconSeq.current) updateEl(el.id, { src, iconColor: c });
    } catch {}
  }

  // ---------- custom fonts ----------
  async function addFontFile(file) {
    setFontMsg('');
    try {
      const src = await fontFileToDataUrl(file);
      const family = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^\w \-]/g, ' ').trim().slice(0, 50) || 'Custom font';
      if (!(await loadFontFile(family, src))) throw new Error("That file doesn't look like a font.");
      commit((d) => ({ ...d, fonts: [...(d.fonts || []).filter((f) => f.family !== family), { family, src }] }));
      setFontMsg(`Added “${family}”. Pick it from the font list.`);
      if (sel?.type === 'text') updateSel({ fontFamily: family });
    } catch (e) {
      setFontMsg(e.message);
    }
  }
  async function addGoogleFont(name) {
    const family = name.trim().replace(/\s+/g, ' ');
    if (!family) return;
    setFontMsg(`Loading ${family}…`);
    if (!(await loadGoogleFont(family))) { setFontMsg(`Couldn't find “${family}” on Google Fonts. Check the spelling (e.g. “Roboto Condensed”).`); return; }
    commit((d) => ({ ...d, googleFonts: [...new Set([...(d.googleFonts || []), family])] }));
    setFontMsg(`Added “${family}”.`);
    setGFont('');
    if (sel?.type === 'text') { updateSel({ fontFamily: family }); loadFont({ ...sel, fontFamily: family }); }
  }

  // Use any font for the selected text. Fonts that aren't built in are added to the design so they load everywhere.
  async function pickFont(f) {
    if (sel?.type !== 'text' || !f) return;
    const d = designRef.current;
    const known = FONTS.includes(f) || (d.fonts || []).some((x) => x.family === f) || (d.googleFonts || []).includes(f);
    updateSel({ fontFamily: f });
    if (!known) {
      commit((x) => ({ ...x, googleFonts: [...new Set([...(x.googleFonts || []), f])] }), { history: false });
      await loadGoogleFont(f);
    }
    loadFont({ ...sel, fontFamily: f });
  }

  // ---------- photo search ----------
  async function pickPhoto(r, asBackground) {
    setBusy('Adding photo…');
    try {
      const blob = await (await fetch(r.full || `/api/images/${r.id}?full=1`)).blob();
      if (!blob.type.startsWith('image/')) throw new Error('That image is not available.');
      const a = { id: uid(), ...(await fileToDataUrl(blob, 1800)), credit: `${r.title || 'Photo'}${r.creator ? ` by ${r.creator}` : ''} (${r.license})`, source: r.source };
      commit((d) => ({ ...d, assets: [a, ...(d.assets || [])] }));
      if (asBackground) setBg({ type: 'image', src: a.src, color: '#ffffff' });
      else insertAsset(a);
    } catch (e) {
      alert(e.message || 'Could not add that photo.');
    } finally {
      setBusy('');
    }
  }

  // ---------- AI ----------
  async function applyAi(reply, _idea, progress) {
    if (ai === 'text') {
      const text = stripFences(reply);
      if (!text) throw new Error('The reply was empty.');
      updateSel({ text });
      return;
    }
    if (ai === 'palette') {
      const list = aiToPalette(extractJson(reply));
      // Recolor the page: map its colors (most used first) onto the new palette.
      const used = designColors({ pages: [page] });
      const map = new Map(used.map((c, i) => [c, list[i % list.length]]));
      const sw = (c) => (typeof c === 'string' && map.has(c.toLowerCase()) ? map.get(c.toLowerCase()) : c);
      commit((d) => mapPage(d, (p) => ({
        ...p,
        background: { ...p.background, color: sw(p.background?.color), from: sw(p.background?.from), to: sw(p.background?.to) },
        elements: p.elements.map((e) => ({ ...e, color: sw(e.color), fill: sw(e.fill), gradient: sw(e.gradient), stroke: sw(e.stroke), bgColor: sw(e.bgColor) })),
      })));
      return;
    }
    let pages = aiToPages(extractJson(reply), W, H);
    pages = await fillAiImages(pages, progress);
    // Load any fonts the AI picked that aren't built in, and remember them in the design.
    const newFonts = extraFonts(pages);
    if (newFonts.length) {
      progress?.('Loading fonts…');
      await Promise.all(newFonts.map((f) => loadGoogleFont(f)));
      commit((d) => ({ ...d, googleFonts: [...new Set([...(d.googleFonts || []), ...newFonts])] }), { history: false });
    }
    pages = pages.map((p) => ({ ...p, elements: p.elements.map(fixEl) }));
    if (ai === 'page') {
      commit((d) => ({ ...d, pages: d.pages.map((p, i) => (i === pi ? { ...pages[0], id: p.id, notes: p.notes } : p)) }));
    } else if (ai === 'redo') {
      // Replace every page (undo brings the old design back).
      commit((d) => ({ ...d, pages }));
      setPageIdx(0);
    } else {
      commit((d) => { const all = [...d.pages]; all.splice(pi + 1, 0, ...pages); return { ...d, pages: all }; });
      setPageIdx(pi + 1);
    }
    setSelId(null);
    pages.forEach((p) => p.elements.forEach((e) => e.type === 'text' && loadFont(e)));
  }

  // ---------- resized copy ----------
  async function resizedCopy(nw, nh) {
    const d = designRef.current;
    nw = Math.round(Math.min(8000, Math.max(16, nw)));
    nh = Math.round(Math.min(8000, Math.max(16, nh)));
    const copy = { ...d, width: nw, height: nh, pages: d.pages.map((p) => { const sp = scalePage(p, d.width, d.height, nw, nh); return { ...sp, elements: sp.elements.map(fixEl) }; }) };
    const r = await fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${title} (${nw}×${nh})`, design: copy }) });
    if (!r.ok) { alert('Could not make the copy.'); return; }
    const { id: nid } = await r.json();
    setModal(null);
    window.open(`/design/${nid}`, '_blank');
  }

  // ---------- fonts ----------
  const loadFont = useCallback((el) => {
    if (!document.fonts) return;
    document.fonts.load(textFont(el, 32)).then(() => {
      const d = designRef.current;
      const next = { ...d, pages: d.pages.map((p) => ({ ...p, elements: p.elements.map((e) => (e.type === 'text' && e.fontFamily === el.fontFamily ? measureText(e) : e)) })) };
      designRef.current = next;
      setDesign(next);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('share') === '1') setModal('share');
  }, []);

  useEffect(() => {
    registerFonts(designRef.current).then(() => ensureFonts(designRef.current)).then(() => {
      const d = designRef.current;
      const next = { ...d, pages: d.pages.map((p) => ({ ...p, elements: p.elements.map(fixEl) })) };
      designRef.current = next;
      setDesign(next);
    });
  }, []);

  // ---------- zoom to fit ----------
  const fit = useCallback(() => {
    const s = scrollRef.current;
    if (!s) return;
    const z = Math.min((s.clientWidth - 80) / W, (s.clientHeight - 80) / H);
    setZoom(Math.max(0.05, Math.min(4, z)));
  }, [W, H]);
  useEffect(() => {
    if (!autoFit) return;
    fit();
    const ro = new ResizeObserver(fit);
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [autoFit, fit]);

  // ---------- thumbnail (small preview image used in lists) ----------
  const thumbTimer = useRef(null);
  const thumbFor = useRef(null);
  const makeThumb = useCallback(async () => {
    const d = designRef.current;
    if (thumbFor.current === d || !d.pages?.[0]) return;
    thumbFor.current = d;
    try {
      const s = Math.min(1, 480 / Math.max(d.width, d.height));
      const canvas = await renderPageToCanvas(d, d.pages[0], s);
      const thumb = canvas.toDataURL('image/webp', 0.8);
      await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thumb }) });
    } catch {
      thumbFor.current = null;
    }
  }, [id]);
  useEffect(() => () => clearTimeout(thumbTimer.current), []);

  // ---------- saving (retries, offline, browser backup, conflict check: see lib/saver.js) ----------
  const saver = useSaver({
    id,
    version,
    getBody: () => ({ design: designRef.current, title: titleRef.current }),
    onLocked: () => { lockedOut.current = true; setLost((cur) => cur || { reason: 'removed', view: false }); },
    onSaved: () => { clearTimeout(thumbTimer.current); thumbTimer.current = setTimeout(makeThumb, 2500); },
    onRestore: (body) => {
      if (body?.design) { const d = normalizeDesign(body.design); designRef.current = d; setDesign(d); }
      if (typeof body?.title === 'string') setTitle(body.title);
    },
  });
  const save = saver.state;

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (remoteRef.current) { remoteRef.current = false; return; }
    if (!lockedOut.current) saver.changed();
  }, [design, title]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveNow() {
    await saver.now();
  }

  // ---------- live cursors + live updates ----------
  const { people } = useLive({
    id, on: live && !lost, page: pi, posRef, selRef, saver,
    onRemote: (data, newTitle, v) => {
      remoteRef.current = true;
      const d = normalizeDesign(data);
      const next = { ...d, pages: d.pages.map((p) => ({ ...p, elements: p.elements.map(fixEl) })) };
      designRef.current = next;
      setDesign(next);
      if (typeof newTitle === 'string') setTitle(newTitle);
      saver.setVersion(v);
      registerFonts(next).catch(() => {});
    },
  });

  async function changeVisibility(v) {
    setVisibility(v);
    await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) });
  }

  // ---------- uploads ----------
  // Any file: photos, videos, sounds, PDFs (each page becomes a page), fonts and Jace Design files.
  async function addFiles(files, opts) {
    const list = [...files];
    const images = list.filter((f) => f.type.startsWith('image/'));
    if (images.length) await addImages(images, opts);
    for (const f of list) {
      if (f.type.startsWith('image/')) continue;
      const name = (f.name || '').toLowerCase();
      try {
        if (f.type.startsWith('video/') || /\.(mp4|m4v|webm|mov)$/.test(name)) await addVideo(f);
        else if (f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac)$/.test(name)) await addSound(f);
        else if (f.type === 'application/pdf' || name.endsWith('.pdf')) await addPdf(f);
        else if (/\.(ttf|otf|woff2?)$/.test(name)) { await addFontFile(f); setPanel('text'); }
        else if (name.endsWith('.json')) await addDesignFile(f);
        else alert(`“${f.name}” isn't a kind of file Jace Design can use. Try photos, videos, sounds, PDFs, fonts or Jace Design files.`);
      } catch (e) {
        alert(e.message || `Could not add “${f.name}”.`);
      } finally {
        setBusy('');
      }
    }
  }

  async function addVideo(f) {
    setBusy('Reading video…');
    const info = await videoInfo(f);
    const src = await uploadMedia(f, { onProgress: (p) => setBusy(`Uploading video… ${Math.round(p * 100)}%`) });
    const a = { id: uid(), kind: 'video', src, poster: info.poster, width: info.width, height: info.height, duration: Math.round(info.duration * 10) / 10, name: f.name.slice(0, 80) };
    commit((d) => ({ ...d, assets: [a, ...(d.assets || [])] }));
    insertAsset(a);
  }
  async function addSound(f) {
    setBusy('Uploading sound…');
    const duration = await audioDuration(f);
    const src = await uploadMedia(f, { onProgress: (p) => setBusy(`Uploading sound… ${Math.round(p * 100)}%`) });
    const a = { id: uid(), kind: 'audio', src, name: f.name.slice(0, 80), duration: Math.round(duration * 10) / 10 };
    if (isVideo && !designRef.current.audio) { commit((d) => ({ ...d, audio: { src, name: a.name, volume: 0.8 }, assets: [a, ...(d.assets || [])] })); return; }
    commit((d) => ({ ...d, assets: [a, ...(d.assets || [])] }));
    insertAsset(a);
  }
  async function addPdf(f) {
    setBusy('Opening PDF…');
    const pdfjs = await import(/* webpackIgnore: true */ 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, 30);
    const added = [];
    for (let i = 1; i <= n; i++) {
      setBusy(`Adding PDF page ${i} of ${n}…`);
      const pg = await doc.getPage(i);
      const vp1 = pg.getViewport({ scale: 1 });
      const scale = Math.min(2.5, Math.max(1, (Math.max(W, H) * 1.3) / Math.max(vp1.width, vp1.height)));
      const vp = pg.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const s2 = Math.min(W / c.width, H / c.height);
      const w = c.width * s2, h = c.height * s2;
      added.push({ ...blankPage(), elements: [imageEl({ src: c.toDataURL('image/jpeg', 0.85), x: (W - w) / 2, y: (H - h) / 2, w, h })] });
    }
    commit((d) => { const pages = [...d.pages]; const empty = !pages[pi].elements.length; pages.splice(empty ? pi : pi + 1, empty ? 1 : 0, ...added); return { ...d, pages }; });
    if (page.elements.length) setPageIdx(pi + 1);
    setSelId(null);
    if (doc.numPages > n) alert(`Added the first ${n} pages of ${doc.numPages}.`);
  }
  async function addDesignFile(f) {
    let j;
    try { j = JSON.parse(await f.text()); } catch { throw new Error("That file isn't a Jace Design file."); }
    const td = normalizeDesign(j?.design || j);
    if (!td.pages?.length || td.kind === 'doc' || td.kind === 'sheet') throw new Error("That file doesn't have pages that can go into this design.");
    applyTemplate({ make: () => td.pages, width: td.width, height: td.height });
  }

  async function addImages(files, { insert = true } = {}) {
    const list = files;
    if (!list.length) return;
    setBusy('Uploading…');
    try {
      const added = [];
      for (const f of list) added.push({ id: uid(), ...(await fileToDataUrl(f)) });
      commit((d) => ({ ...d, assets: [...added, ...(d.assets || [])] }));
      if (insert) {
        for (const a of added) {
          const s = Math.min((W * 0.6) / a.width, (H * 0.6) / a.height, 1 / Math.max(0.0001, 1));
          addEl(imageEl({ src: a.src, w: a.width * s, h: a.height * s }));
        }
      }
    } catch (e) {
      alert(`Could not add that image: ${e.message || e}`);
    } finally {
      setBusy('');
    }
  }
  const insertAsset = (a) => {
    if (a.kind === 'audio') { addEl(audioEl({ src: a.src, name: a.name, duration: a.duration, w: 140 * k, h: 140 * k })); return; }
    const s = Math.min((W * 0.6) / a.width, (H * 0.6) / a.height);
    if (a.kind === 'video') {
      addEl(videoEl({ src: a.src, poster: a.poster, duration: a.duration, trimEnd: a.duration, w: a.width * s, h: a.height * s }));
      // In a video, make the scene long enough for the clip.
      if (isVideo && a.duration > (Number(page.duration) || 3)) commit((d) => mapPage(d, (p) => ({ ...p, duration: Math.min(60, Math.ceil(a.duration * 10) / 10) })), { history: false });
      return;
    }
    addEl(imageEl({ src: a.src, w: a.width * s, h: a.height * s }));
  };

  // ---------- keyboard + clipboard ----------
  useEffect(() => {
    const onKey = (e) => {
      if (modal === 'present' || modal === 'history') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); return; }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === 'c') { if (sel) clipRef.current = sel; return; }
      if (mod && e.key.toLowerCase() === 'x') { if (sel) { clipRef.current = sel; deleteSel(); } return; }
      if (mod && e.key === ']') { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'up'); return; }
      if (mod && e.key === '[') { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'down'); return; }
      if (e.key === 'Escape') { setSelId(null); setMulti([]); setEditingId(null); setPen(null); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectIds(page.elements.filter((x) => !x.hidden && !x.locked).map((x) => x.id)); return; }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) { if (multi.length) ungroupSel(); else if (sel?.group) updateSel({ group: undefined }); } else groupSel();
        return;
      }
      if (multi.length > 1) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteMany(); return; }
        const st = e.shiftKey ? 10 : 1;
        const mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
        if (mv) { e.preventDefault(); updateMany((x) => (x.locked ? {} : { x: x.x + mv[0], y: x.y + mv[1] })); }
        return;
      }
      if (!sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
      if (e.key === 'Enter' && sel.type === 'text') { e.preventDefault(); snapshot(); setEditingId(sel.id); return; }
      const step = e.shiftKey ? 10 : 1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && !sel.locked) { e.preventDefault(); updateSel({ x: sel.x + d[0], y: sel.y + d[1] }); }
    };
    const onPaste = (e) => {
      if (isTyping(e.target)) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); addFiles(files); return; }
      if (clipRef.current) {
        e.preventDefault();
        const c = { ...clipRef.current, id: uid(), x: clipRef.current.x + 24 * k, y: clipRef.current.y + 24 * k };
        clipRef.current = c;
        addEl(c, { center: false });
        return;
      }
      const text = e.clipboardData?.getData('text/plain');
      if (text) { e.preventDefault(); addEl(textEl({ text: text.slice(0, 2000), fontSize: 40 * k, w: W * 0.6 })); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
  });

  // ---------- pointer interactions ----------
  const toDesign = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  function snapMove(el, nx, ny) {
    const t = 6 / zoom;
    const xs = [0, W / 2, W];
    const ys = [0, H / 2, H];
    for (const o of page.elements) {
      if (o.id === el.id || o.hidden || o.rotation) continue;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    const g = [];
    let bx = null, by = null;
    for (const off of [0, el.w / 2, el.w]) for (const c of xs) if (Math.abs(nx + off - c) < t && (bx == null || Math.abs(nx + off - c) < Math.abs(bx.d))) bx = { d: nx + off - c, c };
    for (const off of [0, el.h / 2, el.h]) for (const c of ys) if (Math.abs(ny + off - c) < t && (by == null || Math.abs(ny + off - c) < Math.abs(by.d))) by = { d: ny + off - c, c };
    if (bx) { nx -= bx.d; g.push({ v: true, at: bx.c }); }
    if (by) { ny -= by.d; g.push({ v: false, at: by.c }); }
    return { nx, ny, g };
  }

  // ---------- pen (freehand drawing) ----------
  function startPen(e) {
    e.preventDefault();
    const pts = [toDesign(e)];
    setStroke(pts.slice());
    const move = (ev) => {
      const p = toDesign(ev);
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) * zoom < 2) return;
      pts.push(p);
      setStroke(pts.slice());
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setStroke(null);
      if (pts.length < 2) return;
      const pad = pen.width / 2;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
      const w = Math.max(4, Math.max(...xs) - x + pad), h = Math.max(4, Math.max(...ys) - y + pad);
      addEl({
        id: uid(), type: 'draw', x, y, w, h, rotation: 0, opacity: 1, locked: false, hidden: false,
        stroke: pen.color, strokeWidth: pen.width,
        points: pts.map((p) => [Math.round(((p.x - x) / w) * 10000) / 10000, Math.round(((p.y - y) / h) * 10000) / 10000]),
      }, { center: false });
      setSelId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onCanvasDown(e) {
    if (e.button !== 0) return;
    if (pen) { startPen(e); return; }
    if (e.target.tagName === 'TEXTAREA' || e.target.classList?.contains('handle')) return;
    const target = e.target.closest?.('[data-id]');
    if (!target) { setEditingId(null); startMarquee(e); return; }
    const eid = target.getAttribute('data-id');
    const el = page.elements.find((x) => x.id === eid);
    if (!el) return;
    if (editingId && editingId !== eid) setEditingId(null);
    // Shift-click adds or removes things from the selection.
    if (e.shiftKey) {
      const cur = multi.length ? multi : selId ? [selId] : [];
      const next = cur.includes(eid) ? cur.filter((x) => x !== eid) : [...cur, eid];
      selectIds(next);
      return;
    }
    // Clicking part of a group picks the whole group (Ctrl/⌘-click picks just that one).
    let ids = [eid];
    if (multi.includes(eid)) ids = multi;
    else if (el.group && !(e.ctrlKey || e.metaKey)) ids = page.elements.filter((x) => x.group === el.group).map((x) => x.id);
    selectIds(ids);
    if (ids.length > 1) { e.preventDefault(); dragMany(e, ids); return; }
    if (el.locked) return;
    e.preventDefault();
    const start = { cx: e.clientX, cy: e.clientY, x: el.x, y: el.y };
    let moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - start.cx) / zoom;
      const dy = (ev.clientY - start.cy) / zoom;
      if (!moved && Math.hypot(ev.clientX - start.cx, ev.clientY - start.cy) < 3) return;
      if (!moved) { moved = true; snapshot(); }
      let { nx, ny, g } = ev.altKey ? { nx: start.x + dx, ny: start.y + dy, g: [] } : snapMove(el, start.x + dx, start.y + dy);
      setGuides(g);
      updateEl(eid, { x: nx, y: ny }, { history: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setGuides([]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------- selecting several things ----------
  function selectIds(ids) {
    if (ids.length > 1) { setMulti(ids); setSelId(null); }
    else { setMulti([]); setSelId(ids[0] || null); }
  }
  function startMarquee(e) {
    e.preventDefault();
    const p0 = toDesign(e);
    const add = e.shiftKey ? (multi.length ? multi : selId ? [selId] : []) : [];
    if (!e.shiftKey) selectIds([]);
    let box = null;
    const move = (ev) => {
      const p = toDesign(ev);
      box = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
      if (box.w * zoom > 3 || box.h * zoom > 3) setMarquee(box);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      if (!box || (box.w * zoom < 4 && box.h * zoom < 4)) return;
      const hit = page.elements.filter((x) => !x.hidden && !x.locked && x.x < box.x + box.w && x.x + x.w > box.x && x.y < box.y + box.h && x.y + x.h > box.y).map((x) => x.id);
      // Whole groups come along.
      const groups = new Set(page.elements.filter((x) => hit.includes(x.id) && x.group).map((x) => x.group));
      const all = page.elements.filter((x) => hit.includes(x.id) || (x.group && groups.has(x.group))).map((x) => x.id);
      selectIds([...new Set([...add, ...all])]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function dragMany(e, ids) {
    const start = { cx: e.clientX, cy: e.clientY };
    const from = new Map(page.elements.filter((x) => ids.includes(x.id) && !x.locked).map((x) => [x.id, { x: x.x, y: x.y }]));
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.cx, ev.clientY - start.cy) < 3) return;
      if (!moved) { moved = true; snapshot(); }
      const dx = (ev.clientX - start.cx) / zoom, dy = (ev.clientY - start.cy) / zoom;
      commit((d) => mapPage(d, (p) => ({ ...p, elements: p.elements.map((x) => (from.has(x.id) ? { ...x, x: from.get(x.id).x + dx, y: from.get(x.id).y + dy } : x)) })), { history: false });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  const multiEls = page.elements.filter((x) => multi.includes(x.id));
  const multiBox = multiEls.length > 1 ? (() => {
    const x0 = Math.min(...multiEls.map((x) => x.x)), y0 = Math.min(...multiEls.map((x) => x.y));
    return { x: x0, y: y0, w: Math.max(...multiEls.map((x) => x.x + x.w)) - x0, h: Math.max(...multiEls.map((x) => x.y + x.h)) - y0 };
  })() : null;
  const updateMany = (fn, opts) => commit((d) => mapPage(d, (p) => ({ ...p, elements: p.elements.map((x) => (multi.includes(x.id) ? fixEl({ ...x, ...fn(x) }) : x)) })), opts);
  const groupSel = () => { if (multi.length > 1) { const g = uid(); updateMany(() => ({ group: g })); } };
  const ungroupSel = () => updateMany(() => ({ group: undefined }));
  const deleteMany = () => { commit((d) => mapPage(d, (p) => ({ ...p, elements: p.elements.filter((x) => !multi.includes(x.id)) }))); setMulti([]); };
  const duplicateMany = () => {
    const g = new Map();
    const copies = multiEls.map((x) => ({ ...x, id: uid(), x: x.x + 24 * k, y: x.y + 24 * k, locked: false, group: x.group ? (g.get(x.group) || g.set(x.group, uid()).get(x.group)) : undefined }));
    commit((d) => mapPage(d, (p) => ({ ...p, elements: [...p.elements, ...copies] })));
    setMulti(copies.map((x) => x.id));
  };
  function alignMany(how) {
    const b = multiBox;
    if (!b) return;
    updateMany((x) => ({
      left: { x: b.x }, center: { x: b.x + (b.w - x.w) / 2 }, right: { x: b.x + b.w - x.w },
      top: { y: b.y }, middle: { y: b.y + (b.h - x.h) / 2 }, bottom: { y: b.y + b.h - x.h },
    }[how]));
  }
  function distribute(axis) {
    const list = [...multiEls].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
    if (list.length < 3) return;
    const size = axis === 'x' ? 'w' : 'h';
    const first = list[0][axis], last = list[list.length - 1][axis] + list[list.length - 1][size];
    const gap = (last - first - list.reduce((n, x) => n + x[size], 0)) / (list.length - 1);
    let at = first;
    const pos = new Map(list.map((x) => { const v = at; at += x[size] + gap; return [x.id, v]; }));
    updateMany((x) => ({ [axis]: pos.get(x.id) }));
  }
  useEffect(() => { setMulti([]); }, [pi]);

  function onCanvasDouble(e) {
    const target = e.target.closest?.('[data-id]');
    if (!target) return;
    const el = page.elements.find((x) => x.id === target.getAttribute('data-id'));
    if (el?.type === 'text' && !el.locked) { snapshot(); setSelId(el.id); setEditingId(el.id); }
  }

  function onHandleDown(e, dir) {
    e.stopPropagation();
    e.preventDefault();
    const el = sel;
    if (!el || el.locked) return;
    snapshot();
    const rad = (el.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx0 = el.x + el.w / 2, cy0 = el.y + el.h / 2;
    const p0 = toDesign(e);
    const hx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
    const hy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
    const corner = hx && hy;
    const move = (ev) => {
      if (dir === 'rot') {
        const p = toDesign(ev);
        let a = Math.atan2(p.y - cy0, p.x - cx0) * 180 / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        else for (const s of [0, 90, 180, 270, 360, -90]) if (Math.abs(a - s) < 4) a = s;
        a = ((a % 360) + 360) % 360;
        updateEl(el.id, { rotation: Math.round(a * 10) / 10 }, { history: false });
        return;
      }
      const p = toDesign(ev);
      const dx = p.x - p0.x, dy = p.y - p0.y;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      let w = Math.max(8, el.w + hx * lx);
      let h = Math.max(8, el.h + hy * ly);
      const patch = {};
      const keepRatio = corner && (el.type === 'image' || el.type === 'text' || ev.shiftKey);
      if (keepRatio) {
        const s = Math.max(w / el.w, h / el.h);
        w = el.w * s; h = el.h * s;
      }
      if (el.type === 'text') {
        if (corner) {
          const s = w / el.w;
          patch.fontSize = Math.max(4, el.fontSize * s);
          patch.letterSpacing = (el.letterSpacing || 0) * s;
          if (el.strokeWidth) patch.strokeWidth = el.strokeWidth * s;
        }
        h = el.h * (corner ? w / el.w : 1);
      }
      if (el.type === 'line') h = el.h;
      const lcx = hx * (w - el.w) / 2;
      const lcy = hy * (h - el.h) / 2;
      const ncx = cx0 + lcx * cos - lcy * sin;
      const ncy = cy0 + lcx * sin + lcy * cos;
      Object.assign(patch, { w, h, x: ncx - w / 2, y: ncy - h / 2 });
      updateEl(el.id, patch, { history: false });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------- pages ----------
  const addPage = (after = pi) => {
    commit((d) => { const pages = [...d.pages]; pages.splice(after + 1, 0, blankPage()); return { ...d, pages }; });
    setPageIdx(after + 1); setSelId(null);
  };
  const dupPage = () => {
    commit((d) => {
      const pages = [...d.pages];
      const p = pages[pi];
      pages.splice(pi + 1, 0, { ...p, id: uid(), elements: p.elements.map((e) => ({ ...e, id: uid() })) });
      return { ...d, pages };
    });
    setPageIdx(pi + 1); setSelId(null);
  };
  const delPage = () => {
    if (design.pages.length < 2) return;
    commit((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pi) }));
    setPageIdx(Math.max(0, pi - 1)); setSelId(null);
  };
  const movePage = (dir) => {
    const to = pi + dir;
    if (to < 0 || to >= design.pages.length) return;
    commit((d) => { const pages = [...d.pages]; const [p] = pages.splice(pi, 1); pages.splice(to, 0, p); return { ...d, pages }; });
    setPageIdx(to);
  };

  function applyTemplate(t) {
    const td = templateDesign(t);
    const scaled = td.pages.map((p) => {
      const sp = scalePage(p, td.width, td.height, W, H);
      return { ...sp, elements: sp.elements.map(fixEl) };
    });
    commit((d) => {
      const pages = [...d.pages];
      if (!pages[pi].elements.length) pages.splice(pi, 1, ...scaled);
      else pages.splice(pi + 1, 0, ...scaled);
      return { ...d, pages };
    });
    if (page.elements.length) setPageIdx(pi + 1);
    setSelId(null);
    scaled.forEach((p) => p.elements.forEach((e) => e.type === 'text' && loadFont(e)));
  }

  function resizeDesign(nw, nh, scaleContent) {
    nw = Math.round(Math.min(8000, Math.max(16, nw)));
    nh = Math.round(Math.min(8000, Math.max(16, nh)));
    commit((d) => ({
      ...d, width: nw, height: nh,
      pages: scaleContent ? d.pages.map((p) => { const sp = scalePage(p, d.width, d.height, nw, nh); return { ...sp, id: p.id, elements: sp.elements.map(fixEl) }; }) : d.pages,
    }));
    setModal(null);
    setAutoFit(true);
    setTimeout(fit, 30);
  }

  // ---------- export / print ----------
  async function runExport(kind) {
    setModal(null);
    setBusy('Preparing download…');
    try {
      const d = designRef.current;
      if (kind === 'png') await exportImage(d, title, { format: 'png', pageIndex: pi });
      if (kind === 'png-all') await exportImage(d, title, { format: 'png' });
      if (kind === 'png-hd') await exportImage(d, title, { format: 'png', pageIndex: pi, quality: 4 });
      if (kind === 'jpg') await exportImage(d, title, { format: 'jpg', pageIndex: pi });
      if (kind === 'pdf') await exportPdf(d, title);
      if (kind === 'svg') { const svg = document.getElementById('export-svg'); if (svg) exportSvg(svg, title); }
      if (kind === 'json') exportJson(d, title);
      if (kind === 'video' || kind === 'video-hd') {
        const { exportVideo } = await import('@/lib/video');
        const scale = kind === 'video-hd' ? 1 : Math.min(1, 1280 / Math.max(d.width, d.height));
        await exportVideo(d, title, { scale, onProgress: (s, total) => setBusy(`Recording video… ${Math.round((s / total) * 100)}% (keep this tab open)`) });
      }
    } catch (e) {
      alert(`Export failed: ${e.message || e}`);
    } finally {
      setBusy('');
    }
  }
  async function print() {
    await saveNow();
    window.open(`/d/${id}/print`, '_blank');
  }

  // ---------- render helpers ----------
  const renderPage = useMemo(() => {
    if (!editingId) return page;
    return { ...page, elements: page.elements.map((e) => (e.id === editingId ? { ...e, hidden: true } : e)) };
  }, [page, editingId]);

  const editingEl = editingId ? page.elements.find((e) => e.id === editingId) : null;
  const handles = sel && !sel.locked
    ? sel.type === 'text' ? ['nw', 'ne', 'se', 'sw', 'e', 'w'] : sel.type === 'line' ? ['e', 'w'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    : [];
  const hpos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
  const cursor = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
  const saveLabel = saver.label;

  return (
    <div className="editor">
      {/* ---------- top bar ---------- */}
      <div className="ed-top">
        <Link href="/" className="btn btn-sm" title="Home">🏠</Link>
        <button className="btn btn-sm" onClick={() => setModal(modal === 'resize' ? null : 'resize')}>📐 Resize</button>
        <button className="btn btn-sm" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)">↶</button>
        <button className="btn btn-sm" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)">↷</button>
        <input className="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Design title" />
        <span className={`ed-status save-${save}`} title={save === 'error' || save === 'retrying' ? 'Click to try again now' : ''} onClick={() => (save === 'error' || save === 'retrying' || save === 'offline') && saver.retry()}>{busy || saveLabel}</span>
        <div className="grow" />
        <button className={`btn btn-sm ${live ? 'active' : ''}`} onClick={toggleLive}
          title={live ? 'Live is on: you see the cursors of others who have it on, and their changes appear as they save. Click to turn off.' : 'Turn on live cursors and live updates'}>
          👥 Live{live ? ' on' : ''}
        </button>
        {live && people.length ? (
          <div className="live-faces">
            {people.slice(0, 5).map((p) => <span key={p.sess} title={`${p.name}${p.page !== pi ? ` (page ${p.page + 1})` : ''}`} style={{ background: p.color }}>{(p.name || '?').slice(0, 1).toUpperCase()}</span>)}
          </div>
        ) : null}
        <button className="btn btn-sm" onClick={() => setModal('history')} title="Version history">🕘</button>
        {isSite ? <button className="btn btn-sm" onClick={async () => { await saveNow(); window.open(`/s/${id}`, '_blank'); }}>🌐 View site</button> : null}
        {isVideo
          ? <button className="btn btn-sm btn-white" onClick={() => setModal('play')}>▶ Play</button>
          : <button className="btn btn-sm" onClick={() => setModal('present')}>▶ Present</button>}
        <button className="btn btn-sm" onClick={print}>🖨 Print</button>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => setModal(modal === 'download' ? null : 'download')}>⬇ Download</button>
          {modal === 'download' ? (
            <div className="dropdown">
              <button onClick={() => runExport('png')}>🖼 PNG <small>this page</small></button>
              <button onClick={() => runExport('png-hd')}>✨ PNG HD <small>4× size</small></button>
              <button onClick={() => runExport('png-all')}>🗂 PNG <small>all pages</small></button>
              <button onClick={() => runExport('jpg')}>📷 JPG <small>this page</small></button>
              <button onClick={() => runExport('pdf')}>📄 PDF <small>all pages</small></button>
              <button onClick={() => runExport('svg')}>✏️ SVG <small>this page</small></button>
              {isVideo ? <button onClick={() => runExport('video')}>🎬 Video <small>MP4, 720p</small></button> : null}
              {isVideo ? <button onClick={() => runExport('video-hd')}>🎞 Video HD <small>full size</small></button> : null}
              <button onClick={() => runExport('json')}>💾 Jace Design file <small>re-import later</small></button>
            </div>
          ) : null}
        </div>
        {role === 'owner' ? <button className="btn btn-sm" onClick={() => setModal('template')} title="Save as a template you or others can reuse">📌 Template</button> : null}
        <button className="btn btn-sm btn-white" onClick={() => setModal('share')}>🔗 Share</button>
      </div>

      {modal === 'resize' ? <ResizeMenu W={W} H={H} onApply={resizeDesign} onCopy={resizedCopy} onClose={() => setModal(null)} /> : null}
      {modal === 'template' ? <SaveTemplate id={id} title={title} beforeSave={saveNow} onClose={() => setModal(null)} /> : null}
      {ai ? (
        <AiHelper
          mode={ai}
          context={{ width: W, height: H, title, pages: 1, text: sel?.type === 'text' ? sel.text : '', design: ai === 'redo' ? design : page }}
          onApply={applyAi}
          onClose={() => setAi(null)}
        />
      ) : null}
      {menu ? (
        <ContextMenu
          x={menu.x} y={menu.y} el={sel} page={page} pages={design.pages} isSite={isSite} colors={colors} hasClip={!!clipRef.current}
          fontInfo={{ designFonts: [...(design.fonts || []).map((f) => f.family), ...(design.googleFonts || [])], uploaded: (design.fonts || []).map((f) => f.family) }}
          onClose={() => setMenu(null)}
          act={{
            update: (patch, opts) => updateSel(patch, opts),
            font: pickFont,
            weight: (w) => { if (sel?.type !== 'text') return; updateSel({ fontWeight: w }); loadFont({ ...sel, fontWeight: w }); },
            uploadFont: addFontFile,
            addGoogleFont,
            setBg, toBackground, bgToImage, deleteSel, duplicateSel, reorder, alignSel, removeBg: removeBackground,
            copy: () => { if (sel) clipRef.current = sel; },
            paste: () => { if (clipRef.current) { const c = { ...clipRef.current, id: uid(), x: clipRef.current.x + 24 * k, y: clipRef.current.y + 24 * k }; clipRef.current = c; addEl(c, { center: false }); } },
            editText: () => { if (sel?.type === 'text') { snapshot(); setEditingId(sel.id); } },
            replace: () => replaceRef.current?.click(),
            upload: () => { setPanel('uploads'); setTimeout(() => uploadRef.current?.click(), 50); },
            ai: (mode) => setAi(mode),
            addPage: () => addPage(), dupPage, delPage,
            canDeletePage: design.pages.length > 1,
          }}
        />
      ) : null}

      <div className={`ed-main ${panel ? '' : 'no-panel'}`}>
        {/* ---------- left rail ---------- */}
        <div className="ed-rail">
          {RAIL.map(([key, icon, label]) => (
            <button key={key} className={panel === key ? 'active' : ''} onClick={() => setPanel(panel === key ? null : key)}>
              <span className="i">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* ---------- left panel ---------- */}
        <div className="ed-panel" style={panel ? undefined : { padding: 0, overflow: 'hidden' }}>
          {panel === 'templates' ? (
            <>
              <h4>Templates</h4>
              <p className="small muted" style={{ marginTop: 0 }}>Click to add. It fills an empty page, or adds new pages after this one. Everything resizes to fit.</p>
              <div className="tile-grid cols-2">
                {TEMPLATES.map((t) => <TemplateTile key={t.id} t={t} onClick={() => applyTemplate(t)} />)}
              </div>
              <UserTemplates onPick={(td) => applyTemplate({ make: () => td.pages, width: td.width, height: td.height })} />
            </>
          ) : null}

          {panel === 'ai' ? (
            <>
              <h4>AI tools</h4>
              <p className="small muted" style={{ marginTop: 0 }}>Works with any AI (ChatGPT, Claude, Gemini…). We write the prompt, you paste the answer back.</p>
              <div className="stack" style={{ gap: 8 }}>
                <button className="text-preset" onClick={() => setAi('redo')}><b>🪄 Redo the whole design</b><div className="small muted">AI redesigns every page: fonts, colors, backgrounds, photos</div></button>
                <button className="text-preset" onClick={() => setAi('pages')}><b>✨ Add pages with AI</b><div className="small muted">Describe new slides or pages</div></button>
                <button className="text-preset" onClick={() => setAi('page')}><b>🪄 Redesign this page</b><div className="small muted">Make page {pi + 1} look better</div></button>
                <button className="text-preset" disabled={sel?.type !== 'text'} onClick={() => setAi('text')}><b>✍️ Rewrite selected text</b><div className="small muted">{sel?.type === 'text' ? `“${sel.text.slice(0, 40)}”` : 'Select some text first'}</div></button>
                <button className="text-preset" onClick={() => setAi('palette')}><b>🎨 New color palette</b><div className="small muted">Recolors this page</div></button>
              </div>
            </>
          ) : null}

          {panel === 'photos' ? <ImageSearch onPick={pickPhoto} /> : null}

          {panel === 'icons' ? (
            <IconSearch color={design.textDefaults?.color || '#16181d'} onPick={(ic) => addEl(imageEl({ src: ic.src, icon: ic.icon, iconColor: ic.iconColor, w: 260 * k, h: 260 * k, fit: 'contain' }))} />
          ) : null}

          {panel === 'brand' ? (
            <BrandKit
              brand={brand} save={saveBrand} fonts={fontList} suggest={designColors(design)} selType={sel?.type}
              onColor={(c) => {
                if (!sel) setBg({ type: 'color', color: c });
                else if (sel.type === 'text' || sel.type === 'table' || sel.type === 'chart') updateSel({ color: c });
                else if (sel.type === 'shape') updateSel({ fill: c });
                else if (sel.type === 'qr') updateSel({ color: c });
                else if (sel.icon) recolorIcon(sel, c);
                else updateSel({ stroke: c, strokeWidth: sel.strokeWidth || Math.max(2, 6 * k) });
              }}
              onFont={async (f) => {
                if (sel?.type === 'text') { await pickFont(f); return; }
                await ensureFontKnown(f);
                if (sel?.type === 'table' || sel?.type === 'chart') { updateSel({ fontFamily: f }); return; }
                addEl(textEl({ text: f, fontFamily: f, fontSize: 64 * k, w: 700 * k }));
              }}
              onLogo={(l) => { const sc = Math.min((W * 0.35) / l.width, (H * 0.35) / l.height); addEl(imageEl({ src: l.src, w: l.width * sc, h: l.height * sc, fit: 'contain' })); }}
            />
          ) : null}

          {panel === 'elements' ? (
            <>
              <h4>Draw</h4>
              <div className="row wrap" style={{ gap: 6 }}>
                <button className={`btn btn-sm ${pen ? 'active' : ''}`} onClick={() => setPen(pen ? null : { color: '#16181d', width: 6 * k })}>
                  ✏️ {pen ? 'Pen on (Esc to stop)' : 'Pen'}
                </button>
                {pen ? ['#16181d', '#e40014', '#155dfc', '#1f9d5a', '#f99c00', '#7c3aed', '#ffffff'].map((c) => (
                  <button key={c} className="swatch" title={c} style={{ width: 24, height: 24, background: c, outline: pen.color === c ? '2px solid var(--brand)' : 'none' }} onClick={() => setPen({ ...pen, color: c })} />
                )) : null}
              </div>
              {pen ? <Range label="Thickness" min={1} max={Math.round(60 * k)} value={Math.round(pen.width)} onChange={(v) => setPen({ ...pen, width: v })} /> : null}
              <h4>Sticky notes</h4>
              <div className="row wrap" style={{ gap: 6 }}>
                {['#fde047', '#fda4af', '#93c5fd', '#86efac', '#fdba74', '#d8b4fe'].map((c) => (
                  <button key={c} className="tile" style={{ width: 44, height: 44, background: c, border: 0, fontSize: 18 }} onClick={() => addSticky(c)} title="Add a sticky note">🗒</button>
                ))}
              </div>
              <h4>Shapes</h4>
              <div className="tile-grid">
                {SHAPES.map(([shape, o], i) => {
                  const el = shapeEl(shape, { x: 10, y: shape === 'arrow' ? 30 : 10, w: 80, h: shape === 'arrow' ? 40 : 80, ...o, strokeWidth: o.strokeWidth ? 6 : 0, radius: o.radius ? 18 : 0 });
                  return (
                    <button key={i} className="tile" onClick={() => addEl(shapeEl(shape, { w: 300 * k, h: (o.h || 300) * k, fill: o.fill ?? '#1f9d5a', stroke: o.stroke || '#000000', strokeWidth: (o.strokeWidth || 0) * k, radius: (o.radius || 0) * k }))}>
                      <MiniSvg el={el} />
                    </button>
                  );
                })}
              </div>
              <h4>Lines</h4>
              <div className="tile-grid">
                {[{}, { arrow: true }, { dash: true }].map((o, i) => (
                  <button key={i} className="tile" onClick={() => addEl(lineEl({ w: 400 * k, h: 30 * k, strokeWidth: 8 * k, ...o }))}>
                    <MiniSvg el={lineEl({ x: 10, y: 40, w: 80, h: 20, strokeWidth: 5, ...o })} />
                  </button>
                ))}
              </div>
              <h4>Charts</h4>
              <div className="tile-grid">
                {CHART_TYPES.map(([t, n]) => (
                  <button key={t} className="tile" title={`${n} chart`} onClick={() => addEl(withDefaults(chartEl(t, { w: Math.min(W * 0.8, 900 * k), h: Math.min(H * 0.7, 560 * k) }), false))}>
                    <MiniSvg el={chartEl(t, { id: `mini-${t}`, x: 4, y: 8, w: 92, h: 84, fontSize: 6 })} />
                  </button>
                ))}
              </div>
              <h4>Tables</h4>
              <div className="tile-grid">
                {[{}, { headerBg: '#16181d' }, { headerBg: '#155dfc', stripe: '' }, { headerBg: '#ffffff', headerColor: '#16181d', stripe: '', grid: false }].map((o, i) => (
                  <button key={i} className="tile" title="Add a table" onClick={() => addEl(withDefaults(tableEl({ w: Math.min(W * 0.8, 900 * k), h: Math.min(H * 0.5, 320 * k), ...o }), false))}>
                    <MiniSvg el={tableEl({ id: `mini-t${i}`, x: 6, y: 22, w: 88, h: 56, fontSize: 7, ...o })} />
                  </button>
                ))}
              </div>
              <h4>QR code</h4>
              <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => addEl(qrEl({ w: 360 * k, h: 360 * k, text: typeof location !== 'undefined' ? `${location.origin}/d/${id}` : 'https://jaceo.vercel.app' }))}>🔳 Add a QR code</button>
              <p className="small muted" style={{ margin: '4px 0 0' }}>Starts as a link to this design. Type any link or text on the right.</p>
              <h4>Stickers</h4>
              <div className="tile-grid cols-6">
                {EMOJI.map((em) => (
                  <button key={em} className="tile" style={{ fontSize: 20, padding: 2 }} onClick={() => addEl(emojiEl(em, { fontSize: 200 * k, w: 260 * k }))}>{em}</button>
                ))}
              </div>
            </>
          ) : null}

          {panel === 'text' ? (
            <>
              <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => addEl(withDefaults(textEl({ text: 'Your text here', fontSize: 48 * k, w: 600 * k }), false))}>T  Add a text box</button>
              <h4>Default styles</h4>
              <button className="text-preset" onClick={() => addEl(withDefaults(textEl({ text: 'Add a heading', fontFamily: 'Poppins', fontWeight: 700, fontSize: 110 * k, w: Math.min(W * 0.9, 1000 * k), align: 'center' }), true))}><span style={{ fontFamily: tdFont(true, 'Poppins'), fontWeight: 700, fontSize: 24 }}>Add a heading</span></button>
              <button className="text-preset" onClick={() => addEl(withDefaults(textEl({ text: 'Add a subheading', fontFamily: 'Poppins', fontWeight: 400, fontSize: 64 * k, w: Math.min(W * 0.9, 800 * k), align: 'center' }), true))}><span style={{ fontFamily: tdFont(true, 'Poppins'), fontSize: 18 }}>Add a subheading</span></button>
              <button className="text-preset" onClick={() => addEl(withDefaults(textEl({ text: 'Add a little bit of body text', fontSize: 36 * k, w: Math.min(W * 0.9, 700 * k), align: 'center' }), false))}><span style={{ fontFamily: tdFont(false, 'Inter'), fontSize: 13 }}>Add a little bit of body text</span></button>
              <h4>Default text settings</h4>
              <p className="small muted" style={{ marginTop: 0 }}>New text uses these. Apply them to text that's already there with the buttons below.</p>
              <div className="prop">
                <label style={{ gridColumn: 'span 2' }}>Heading font
                  <select value={td.headingFont || ''} onChange={(e) => setTd({ headingFont: e.target.value })} style={{ fontFamily: td.headingFont || undefined }}>
                    <option value="">Same as body font</option>
                    {fontList.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </label>
                <label style={{ gridColumn: 'span 2' }}>Body font
                  <select value={td.font || ''} onChange={(e) => setTd({ font: e.target.value })} style={{ fontFamily: td.font || undefined }}>
                    <option value="">Each style's own font</option>
                    {fontList.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </label>
              </div>
              <ColorRow label="Text color" value={td.color || ''} onChange={(c) => setTd({ color: c })} colors={colors} />
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                <button className="btn btn-sm" disabled={sel?.type !== 'text'} title="Use the selected text's font and color as the defaults" onClick={() => setTd({ font: sel.fontFamily, color: sel.color })}>Use selected text</button>
                <button className="btn btn-sm" disabled={!td.font && !td.headingFont && !td.color} onClick={() => applyTd('page')}>Apply to this page</button>
                <button className="btn btn-sm btn-primary" disabled={!td.font && !td.headingFont && !td.color} onClick={() => applyTd('all')}>Apply to all</button>
                {td.font || td.headingFont || td.color ? <button className="btn btn-sm btn-ghost" onClick={() => commit((d) => { const { textDefaults, ...rest } = d; return rest; })}>Reset</button> : null}
              </div>
              <h4>Buttons</h4>
              <p className="small muted" style={{ marginTop: 0 }}>Add one, then choose where it goes under {isSite ? '“When clicked, go to”' : '“Link”'} (or right-click it).</p>
              <div className="row wrap" style={{ gap: 6 }}>
                {[
                  ['Primary', { bgColor: '#1f9d5a', color: '#ffffff' }],
                  ['Dark', { bgColor: '#16181d', color: '#ffffff' }],
                  ['Light', { bgColor: '#ffffff', color: '#16181d', bgBorder: '#dfe2e7' }],
                  ['Soft', { bgColor: '#e2f4ea', color: '#1f9d5a' }],
                ].map(([name, style]) => (
                  <button key={name} className="btn btn-sm" style={{ background: style.bgColor, color: style.color, borderColor: style.bgBorder || style.bgColor, borderRadius: 99 }}
                    onClick={() => {
                      const fs = 34 * k;
                      const el = addEl(textEl({
                        text: 'Click me', fontFamily: 'Poppins', fontWeight: 700, fontSize: fs, w: 260 * k, align: 'center',
                        bgPadX: 0.9, bgPadY: 0.55, bgRadius: 2, ...style,
                        link: isSite && design.pages.length > 1 ? `#${sectionAnchor(design.pages[1], 1)}` : '',
                      }));
                      return el;
                    }}>
                    {name}
                  </button>
                ))}
              </div>
              <h4>Font combinations</h4>
              {FONT_COMBOS.map(([a, b, ta, tb]) => (
                <button key={a + b} className="text-preset" onClick={() => {
                  const h1 = addEl(textEl({ text: ta, fontFamily: a, fontWeight: a === 'Poppins' ? 700 : 400, fontSize: 100 * k, w: 900 * k, align: 'center' }));
                  addEl({ ...textEl({ text: tb, fontFamily: b, fontSize: 40 * k, w: 900 * k, align: 'center' }), x: h1.x, y: h1.y + h1.h + 20 * k }, { center: false });
                }}>
                  <div style={{ fontFamily: a, fontSize: 22, lineHeight: 1.1 }}>{ta}</div>
                  <div style={{ fontFamily: b, fontSize: 12 }}>{tb}</div>
                </button>
              ))}
              <h4>Your fonts</h4>
              <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => fontFileRef.current?.click()}>⬆️ Upload a font (.ttf .otf .woff .woff2)</button>
              <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addFontFile(f); }} />
              <form className="row" style={{ marginTop: 8, gap: 6 }} onSubmit={(e) => { e.preventDefault(); addGoogleFont(gFont); }}>
                <input className="input" placeholder="Any Google Font, e.g. Roboto Slab" value={gFont} onChange={(e) => setGFont(e.target.value)} style={{ fontSize: 13 }} />
                <button className="btn btn-sm" disabled={!gFont.trim()}>Add</button>
              </form>
              {fontMsg ? <p className="small muted">{fontMsg}</p> : null}
              {[...(design.fonts || []).map((f) => ({ family: f.family, kind: 'file' })), ...(design.googleFonts || []).map((g) => ({ family: g, kind: 'google' }))].map((f) => (
                <div key={f.family} className="layer" onClick={() => sel?.type === 'text' ? updateSel({ fontFamily: f.family }) : addEl(textEl({ text: f.family, fontFamily: f.family, fontSize: 64 * k, w: 700 * k }))}>
                  <span className="name" style={{ fontFamily: `"${f.family}"`, fontSize: 16 }}>{f.family}</span>
                  <span className="small muted">{f.kind === 'file' ? 'uploaded' : 'Google'}</span>
                  <button title="Remove" onClick={(ev) => { ev.stopPropagation(); commit((d) => ({ ...d, fonts: (d.fonts || []).filter((x) => x.family !== f.family), googleFonts: (d.googleFonts || []).filter((x) => x !== f.family) })); }}>✕</button>
                </div>
              ))}
            </>
          ) : null}

          {panel === 'uploads' ? (
            <>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => uploadRef.current?.click()}>☁️ Upload files</button>
              <input ref={uploadRef} type="file" accept="image/*,video/*,audio/*,.pdf,application/pdf,.ttf,.otf,.woff,.woff2,.json" multiple hidden onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; addFiles(fl); }} />
              <p className="small muted">Photos, SVGs and GIFs · videos (MP4, WebM, up to 60 MB) · sounds (MP3, M4A, WAV) · PDFs (each page becomes a page) · fonts · Jace Design files. Drag files onto the canvas or paste them too.</p>
              <h4>Your uploads</h4>
              {design.assets?.length ? (
                <div className="tile-grid cols-2">
                  {design.assets.map((a) => (
                    <div key={a.id} style={{ position: 'relative' }}>
                      <button className="tile" style={{ padding: 0, width: '100%', position: 'relative' }} onClick={() => insertAsset(a)} title={a.credit ? `Add to page · ${a.credit}` : `Add to page${a.name ? ` · ${a.name}` : ''}`}>
                        {a.kind === 'audio'
                          ? <span className="asset-sound">🔊<small>{a.name}</small></span>
                          : <img src={a.kind === 'video' ? a.poster : a.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        {a.kind === 'video' ? <span className="asset-badge">▶ {Math.round(a.duration || 0)}s</span> : null}
                      </button>
                      <div className="row" style={{ position: 'absolute', bottom: 4, right: 4, gap: 4 }}>
                        {!a.kind ? <button className="btn btn-sm" style={{ padding: '2px 6px' }} title="Use as background" onClick={() => setBg({ type: 'image', src: a.src, color: '#ffffff' })}>🖼</button> : null}
                        <button className="btn btn-sm" style={{ padding: '2px 6px' }} title="Remove from uploads" onClick={() => commit((d) => ({ ...d, assets: d.assets.filter((x) => x.id !== a.id) }))}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="small muted">Nothing uploaded yet.</p>}
            </>
          ) : null}

          {panel === 'background' ? (
            <>
              <h4>Every {isVideo ? 'scene' : 'page'}</h4>
              {page.background?.type === 'same' ? <p className="small muted" style={{ marginTop: 0 }}>This {isVideo ? 'scene' : 'page'} uses the background of the one before it. Pick anything below to give it its own.</p> : null}
              <div className="row wrap" style={{ gap: 6 }}>
                {pi > 0 ? (
                  <button className={`btn btn-sm ${page.background?.type === 'same' ? 'active' : ''}`}
                    onClick={() => setBg(page.background?.type === 'same' ? { ...resolveBg(design, page) } : { type: 'same' })}>
                    ↩ Same as previous {isVideo ? 'scene' : 'page'}
                  </button>
                ) : null}
                <button className="btn btn-sm" disabled={design.pages.length < 2} title="Every other page follows this one's background (change it here and they all change)"
                  onClick={() => {
                    const bg = resolveBg(design, page);
                    commit((d) => ({ ...d, pages: d.pages.map((p, i) => ({ ...p, background: i === 0 ? bg : { type: 'same' } })) }));
                    setPageIdx(0);
                  }}>
                  Use on all {isVideo ? 'scenes' : 'pages'}
                </button>
              </div>
              <h4>Colors</h4>
              <div className="tile-grid cols-6">
                {SWATCHES.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => setBg({ type: 'color', color: c })} title={c} />)}
              </div>
              <ColorRow label="Custom color" value={page.background?.type === 'color' ? page.background.color : '#ffffff'} onChange={(c) => setBg({ type: 'color', color: c })} colors={colors} />
              <h4>Gradients</h4>
              <div className="tile-grid cols-6">
                {GRADIENTS.map(([a, b]) => <button key={a + b} className="swatch" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} onClick={() => setBg({ type: 'gradient', from: a, to: b, angle: 135 })} />)}
              </div>
              {page.background?.type === 'gradient' ? (
                <>
                  <ColorRow label="From" value={page.background.from} onChange={(c) => setBg({ ...page.background, from: c })} />
                  <ColorRow label="To" value={page.background.to} onChange={(c) => setBg({ ...page.background, to: c })} />
                  <Range label="Angle" min={0} max={360} value={page.background.angle ?? 135} onChange={(v) => setBg({ ...page.background, angle: v })} suffix="°" />
                </>
              ) : null}
              <h4>Photo</h4>
              {page.background?.type === 'image' ? (
                <>
                  <Range label="Brightness" min={0} max={200} value={page.background.filters?.brightness ?? 100} onChange={(v) => setBg({ ...page.background, filters: { ...page.background.filters, brightness: v } })} suffix="%" />
                  <Range label="Blur" min={0} max={30} value={page.background.filters?.blur ?? 0} onChange={(v) => setBg({ ...page.background, filters: { ...page.background.filters, blur: v } })} suffix="px" />
                  <Range label="Transparency" min={0} max={100} value={Math.round((1 - (page.background.opacity ?? 1)) * 100)} onChange={(v) => setBg({ ...page.background, opacity: 1 - v / 100 })} suffix="%" />
                  <ColorRow label="Behind photo" value={page.background.color || '#ffffff'} onChange={(c) => setBg({ ...page.background, color: c })} colors={colors} />
                  <div className="row wrap" style={{ gap: 6 }}>
                    <button className="btn btn-sm" onClick={bgToImage}>Make it a movable photo</button>
                    <button className="btn btn-sm" onClick={() => setBg({ type: 'color', color: '#ffffff' })}>Remove photo</button>
                  </div>
                </>
              ) : <p className="small muted">Upload an image, then press 🖼 on it in Uploads — or select a photo on the page and choose “Set as background”.</p>}
              <h4>Transparent</h4>
              <button className="btn btn-sm" onClick={() => setBg({ type: 'none' })}>No background (transparent PNG)</button>
            </>
          ) : null}

          {panel === 'layers' ? (
            <>
              <h4>Layers on page {pi + 1}</h4>
              {!page.elements.length ? <p className="small muted">This page is empty.</p> : null}
              {[...page.elements].reverse().map((e) => (
                <div key={e.id} className={`layer ${e.id === selId ? 'active' : ''}`} onClick={() => setSelId(e.id)}>
                  <span>{e.type === 'text' ? 'T' : e.type === 'image' ? (e.icon ? '⭐' : '🖼') : e.type === 'line' ? '—' : e.type === 'draw' ? '✏️' : e.type === 'chart' ? '📊' : e.type === 'table' ? '▦' : e.type === 'qr' ? '🔳' : '◆'}</span>
                  <span className="name" style={{ opacity: e.hidden ? 0.4 : 1 }}>{e.type === 'text' ? e.text.slice(0, 40) : e.type === 'shape' ? e.shape : e.type === 'qr' ? 'QR code' : e.icon ? 'icon' : e.type}</span>
                  <button title={e.hidden ? 'Show' : 'Hide'} onClick={(ev) => { ev.stopPropagation(); updateEl(e.id, { hidden: !e.hidden }); }}>{e.hidden ? '🙈' : '👁'}</button>
                  <button title={e.locked ? 'Unlock' : 'Lock'} onClick={(ev) => { ev.stopPropagation(); updateEl(e.id, { locked: !e.locked }); }}>{e.locked ? '🔒' : '🔓'}</button>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* ---------- canvas ---------- */}
        <div className="ed-center">
          <div
            className="ed-scroll"
            ref={scrollRef}
            onPointerDown={(e) => { if (e.target === scrollRef.current) { setSelId(null); setMulti([]); setEditingId(null); } }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setAutoFit(false); setZoom((z) => Math.max(0.05, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1)))); } }}
          >
            <div className="ed-canvas-wrap" ref={wrapRef} style={{ width: W * zoom, height: H * zoom, background: page.background?.type === 'none' ? 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 20px 20px' : undefined }}
              onPointerDown={onCanvasDown} onDoubleClick={onCanvasDouble}
              onPointerMove={(e) => { if (live) posRef.current = toDesign(e); }}
              onPointerLeave={() => { posRef.current = null; }}
              onContextMenu={(e) => {
                e.preventDefault();
                const t = e.target.closest?.('[data-id]');
                setSelId(t ? t.getAttribute('data-id') : null);
                setEditingId(null);
                setMenu({ x: e.clientX, y: e.clientY });
              }}>
              <DesignPage id="export-svg" design={design} page={renderPage} width={W * zoom} height={H * zoom} uidPrefix="ed-" style={{ cursor: 'default' }} />
              {guides.map((g, i) => (
                <div key={i} className="guide" style={g.v ? { left: g.at * zoom, top: 0, width: 1, height: H * zoom } : { top: g.at * zoom, left: 0, height: 1, width: W * zoom }} />
              ))}
              {live ? <LiveLayer people={people} page={pi} zoom={zoom} elements={page.elements} /> : null}
              {pen ? <div className="pen-layer" title="Drawing with the pen (Esc to stop)" /> : null}
              {stroke ? (
                <svg className="pen-live" viewBox={`0 0 ${W} ${H}`} width={W * zoom} height={H * zoom}>
                  <polyline points={stroke.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={pen?.color} strokeWidth={pen?.width} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {multiBox ? (
                <>
                  {multiEls.map((x) => <div key={x.id} className="multi-box" style={{ left: x.x * zoom, top: x.y * zoom, width: x.w * zoom, height: x.h * zoom, transform: `rotate(${x.rotation || 0}deg)` }} />)}
                  <div className="multi-bounds" style={{ left: multiBox.x * zoom, top: multiBox.y * zoom, width: multiBox.w * zoom, height: multiBox.h * zoom }}>
                    <span>{multiEls.length} selected{multiEls.every((x) => x.group && x.group === multiEls[0].group) ? ' · group' : ''}</span>
                  </div>
                </>
              ) : null}
              {marquee ? <div className="marquee" style={{ left: marquee.x * zoom, top: marquee.y * zoom, width: marquee.w * zoom, height: marquee.h * zoom }} /> : null}
              {sel && !editingId ? (
                <div className={`sel-box ${sel.locked ? 'locked' : ''}`} style={{ left: sel.x * zoom, top: sel.y * zoom, width: sel.w * zoom, height: sel.h * zoom, transform: `rotate(${sel.rotation || 0}deg)` }}>
                  {handles.map((h) => (
                    <div key={h} className={`handle ${h}`} style={{ left: `${hpos[h][0]}%`, top: `${hpos[h][1]}%`, cursor: cursor[h] }} onPointerDown={(e) => onHandleDown(e, h)} />
                  ))}
                  {!sel.locked ? <div className="handle rot" style={{ left: '50%', top: -30 }} onPointerDown={(e) => onHandleDown(e, 'rot')} title="Rotate">⟳</div> : null}
                  {sel.link ? <div className="link-badge">🔗 {linkLabel(sel.link, design.pages)}</div> : null}
                </div>
              ) : null}
              {editingEl ? (
                <textarea
                  className="text-editor"
                  autoFocus
                  value={editingEl.text}
                  onChange={(e) => updateEl(editingEl.id, { text: e.target.value }, { history: false })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); } }}
                  onFocus={(e) => e.target.select()}
                  style={{
                    left: editingEl.x * zoom, top: editingEl.y * zoom, width: editingEl.w * zoom, height: Math.max(editingEl.h, editingEl.fontSize * editingEl.lineHeight) * zoom + 4,
                    transform: `rotate(${editingEl.rotation || 0}deg)`, fontFamily: `"${editingEl.fontFamily}", sans-serif`, fontSize: editingEl.fontSize * zoom,
                    fontWeight: editingEl.fontWeight, fontStyle: editingEl.italic ? 'italic' : 'normal', lineHeight: editingEl.lineHeight, color: editingEl.color,
                    textAlign: editingEl.align, letterSpacing: (editingEl.letterSpacing || 0) * zoom, textTransform: editingEl.uppercase ? 'uppercase' : 'none',
                    textDecoration: editingEl.underline ? 'underline' : 'none',
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="ed-zoom">
            <button className="btn btn-ghost btn-sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.max(0.05, z / 1.25)); }}>−</button>
            <input type="range" min={5} max={400} value={Math.round(zoom * 100)} onChange={(e) => { setAutoFit(false); setZoom(Number(e.target.value) / 100); }} />
            <button className="btn btn-ghost btn-sm" onClick={() => { setAutoFit(false); setZoom((z) => Math.min(4, z * 1.25)); }}>+</button>
            <span style={{ width: 40 }}>{Math.round(zoom * 100)}%</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setAutoFit(true) || fit()}>Fit</button>
          </div>
          {isVideo ? (
            <Timeline
              design={design} pi={pi} setPi={(i) => { setPageIdx(i); setEditingId(null); }} selId={selId} setSelId={setSelId}
              wrapEl={wrapRef.current} zoom={zoom} commit={commit} snapshot={snapshot} onAddScene={() => addPage(design.pages.length - 1)}
            />
          ) : null}
          <div className={`ed-pages ${isVideo ? 'slim' : ''}`}>
            {!isVideo && design.pages.map((p, i) => (
              <div key={p.id} className={`ed-page-thumb ${i === pi ? 'active' : ''}`} onClick={() => { setPageIdx(i); setSelId(null); setEditingId(null); }}>
                <DesignPage design={design} page={p} width={Math.round((72 * design.width) / design.height)} height={72} uidPrefix={`pg${i}-`} />
                <span className="n">{i + 1}{isVideo ? ` · ${Number(p.duration) || 3}s` : ''}</span>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => addPage()} title="Add page">＋ Page</button>
            <button className="btn btn-sm" onClick={dupPage} title="Duplicate page">⧉</button>
            <button className="btn btn-sm" onClick={() => movePage(-1)} disabled={pi === 0} title="Move page left">◀</button>
            <button className="btn btn-sm" onClick={() => movePage(1)} disabled={pi === design.pages.length - 1} title="Move page right">▶</button>
            <button className="btn btn-sm btn-danger" onClick={delPage} disabled={design.pages.length < 2} title="Delete page">🗑</button>
          </div>
        </div>

        {/* ---------- right: properties ---------- */}
        <div className="ed-side">
          {multiBox ? (
            <>
              <h4>{multiEls.length} things selected</h4>
              <div className="toggle-row">
                {multiEls.every((x) => x.group && x.group === multiEls[0].group)
                  ? <button className="btn" onClick={ungroupSel} title="Ctrl/⌘ + Shift + G">Ungroup</button>
                  : <button className="btn btn-primary" onClick={groupSel} title="Ctrl/⌘ + G">Group</button>}
                <button className="btn" onClick={duplicateMany}>⧉ Duplicate</button>
                <button className="btn btn-danger" onClick={deleteMany}>🗑 Delete</button>
              </div>
              <h4>Line up</h4>
              <div className="toggle-row">
                {[['left', '⇤'], ['center', '↔'], ['right', '⇥'], ['top', '⤒'], ['middle', '↕'], ['bottom', '⤓']].map(([a, i]) => (
                  <button key={a} className="btn" title={`Align ${a}`} onClick={() => alignMany(a)}>{i}</button>
                ))}
              </div>
              <div className="toggle-row">
                <button className="btn" disabled={multiEls.length < 3} onClick={() => distribute('x')}>Space evenly ↔</button>
                <button className="btn" disabled={multiEls.length < 3} onClick={() => distribute('y')}>Space evenly ↕</button>
              </div>
              <h4>Look</h4>
              <Range label="Transparency" min={0} max={100} value={Math.round((1 - (multiEls[0].opacity ?? 1)) * 100)} onChange={(v) => updateMany(() => ({ opacity: 1 - v / 100 }))} suffix="%" />
              <div className="toggle-row">
                <button className="btn" onClick={() => updateMany((x) => ({ locked: !multiEls.every((y) => y.locked) }))}>{multiEls.every((y) => y.locked) ? '🔓 Unlock all' : '🔒 Lock all'}</button>
              </div>
              <ul className="small muted" style={{ paddingLeft: 18 }}>
                <li>Drag any of them to move them all</li>
                <li>Shift-click to add or remove one</li>
                <li>Ctrl/⌘-click one item of a group to pick just it</li>
              </ul>
            </>
          ) : sel ? (
            <Props
              el={sel} update={updateSel} k={k} fonts={fontList} colors={colors} isVideo={isVideo} isSite={isSite} pages={design.pages}
              canAnimate={!isSite && !isBoard} recolorIcon={(c) => recolorIcon(sel, c)}
              onPreview={() => setModal(isVideo ? 'play' : 'present')}
              onFont={(e) => loadFont(e)}
              actions={{
                deleteSel, duplicateSel, reorder, alignSel, replace: () => replaceRef.current?.click(), setBg: () => toBackground(sel), aiText: () => setAi('text'),
                fitScene: isVideo ? () => commit((d) => mapPage(d, (p) => ({ ...p, duration: Math.min(60, Math.ceil((clipLength(sel) + (Number(sel.anim?.delay) || 0)) * 10) / 10) }))) : null,
                removeBg: () => removeBackground(sel),
              }}
            />
          ) : (
            <>
              <h4>{isVideo ? `Scene ${pi + 1} of ${design.pages.length}` : `Page ${pi + 1} of ${design.pages.length}`}</h4>
              {isVideo ? (
                <>
                  <Range label="Length" min={0.5} max={20} step={0.5} value={Number(page.duration) || 3} suffix="s"
                    onChange={(v) => commit((d) => mapPage(d, (p) => ({ ...p, duration: v })))} />
                  <div className="prop">
                    <label style={{ gridColumn: 'span 2' }}>Transition into this scene
                      <select value={page.transition || 'fade'} onChange={(e) => commit((d) => mapPage(d, (p) => ({ ...p, transition: e.target.value })))}>
                        {TRANSITIONS.map((t) => <option key={t} value={t}>{TRANSITION_NAMES[t]}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => setModal('play')}>▶ Play from here</button>
                    <button className="btn btn-sm" onClick={() => commit((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, duration: Number(page.duration) || 3, transition: page.transition || 'fade' })) }))}>Use for all scenes</button>
                  </div>
                  <div className="small muted" style={{ marginTop: 6 }}>Whole video: {Math.round(videoLength(design) * 10) / 10}s</div>
                  <h4>Music</h4>
                  {design.audio ? (
                    <>
                      <div className="small">🎵 {design.audio.name}</div>
                      <Range label="Volume" min={0} max={100} value={Math.round((design.audio.volume ?? 0.8) * 100)} suffix="%"
                        onChange={(v) => commit((d) => ({ ...d, audio: { ...d.audio, volume: v / 100 } }), { history: false })} />
                      <button className="btn btn-sm" onClick={() => commit((d) => { const { audio, ...rest } = d; return rest; })}>Remove music</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => audioRef.current?.click()}>🎵 Add music</button>
                      <div className="small muted" style={{ marginTop: 4 }}>Only use music you have the rights to.</div>
                    </>
                  )}
                  <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addAudio(f); }} />
                </>
              ) : null}
              {!isVideo && !isSite && !isBoard ? (
                <>
                  <div className="prop">
                    <label style={{ gridColumn: 'span 2' }}>Transition into this page (when presenting)
                      <select value={page.transition || 'none'} onChange={(e) => commit((d) => mapPage(d, (p) => ({ ...p, transition: e.target.value })))}>
                        {TRANSITIONS.map((t) => <option key={t} value={t}>{TRANSITION_NAMES[t]}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    <button className="btn btn-sm" onClick={() => commit((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, transition: page.transition || 'none' })) }))}>Use for all pages</button>
                    <button className="btn btn-sm btn-primary" onClick={() => setModal('present')}>▶ Present from here</button>
                  </div>
                  <div className="small muted" style={{ marginTop: 6 }}>Select something on the page to give it an animation.</div>
                </>
              ) : null}
              {isSite ? (
                <>
                  <div className="prop">
                    <label style={{ gridColumn: 'span 2' }}>Section name (shown in the site menu)
                      <input value={page.anchor || ''} placeholder="e.g. about"
                        onChange={(e) => {
                          const name = e.target.value.replace(/[^\w-]/g, '-').slice(0, 40);
                          // Keep links to this page working when it's renamed.
                          const from = `#${sectionAnchor(page, pi)}`;
                          const to = `#${sectionAnchor({ anchor: name }, pi)}`;
                          commit((d) => ({
                            ...d,
                            pages: d.pages.map((p, i) => ({
                              ...p,
                              ...(i === pi ? { anchor: name } : {}),
                              elements: p.elements.map((el) => (el.link === from ? { ...el, link: to } : el)),
                            })),
                          }), { history: false });
                        }} />
                    </label>
                    <label style={{ gridColumn: 'span 2' }}>Website title
                      <input value={design.site?.title || ''} placeholder={title}
                        onChange={(e) => commit((d) => ({ ...d, site: { ...(d.site || {}), title: e.target.value.slice(0, 120) } }), { history: false })} />
                    </label>
                  </div>
                  <label className="row small" style={{ gap: 6, marginTop: 6 }}>
                    <input type="checkbox" checked={design.site?.nav !== false} onChange={(e) => commit((d) => ({ ...d, site: { ...(d.site || {}), nav: e.target.checked } }))} />
                    Show a menu bar with the section names
                  </label>
                  <div className="small muted" style={{ marginTop: 6 }}>Give items a Link (select one, see Link) to make buttons. Use #section-name to jump to a section.</div>
                  <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={async () => { await saveNow(); window.open(`/s/${id}`, '_blank'); }}>🌐 View website</button>
                </>
              ) : null}
              <ColorRow label="Background" value={page.background?.type === 'color' ? page.background.color : ''} onChange={(c) => setBg({ type: 'color', color: c })} />
              <h4>Design</h4>
              <div className="small muted">{W} × {H} px</div>
              <div className="row wrap" style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setModal('resize')}>📐 Resize</button>
                <button className="btn btn-sm" onClick={() => setModal('share')}>🔗 Share</button>
              </div>
              <h4>Speaker notes</h4>
              <textarea className="input" rows={4} placeholder="Notes for this page (for presenting)" value={page.notes || ''} onChange={(e) => commit((d) => mapPage(d, (p) => ({ ...p, notes: e.target.value })), { history: false })} />
              <h4>Tips</h4>
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Double-click text to edit it</li>
                <li>Shift while resizing keeps proportions</li>
                <li>Hold Alt while dragging to turn off snapping</li>
                <li>Ctrl/⌘ + D duplicates, + Z undoes</li>
                <li>Drag on an empty spot to select several things, Ctrl/⌘ + G groups them</li>
                <li>Ctrl/⌘ + scroll zooms</li>
              </ul>
            </>
          )}
          <input ref={replaceRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f || !sel) return;
            const a = await fileToDataUrl(f);
            commit((d) => ({ ...d, assets: [{ id: uid(), ...a }, ...(d.assets || [])] }), { history: false });
            updateSel({ src: a.src });
          }} />
        </div>
      </div>

      {modal === 'share' ? (
        <ShareModal id={id} title={title} role={role} visibility={visibility} onVisibility={changeVisibility} onClose={() => setModal(null)}
          onPrint={print} onDownload={() => setModal('download')} />
      ) : null}
      {modal === 'history' ? <VersionHistory id={id} beforeSave={saveNow} onClose={() => setModal(null)} /> : null}
      {modal === 'present' ? <Presenter design={design} start={pi} onClose={() => setModal(null)} /> : null}
      {modal === 'play' ? (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="video-modal">
            <VideoPlayer design={design} autoPlay startAt={design.pages.slice(0, pi).reduce((s, p) => s + (Number(p.duration) || 3), 0)} onClose={() => setModal(null)} maxHeight="78vh" />
          </div>
        </div>
      ) : null}
      <AccessLost id={id} lost={lost} />
      {saver.notices}
    </div>
  );
}

function MiniSvg({ el }) {
  return <DesignPage design={{ width: 100, height: 100 }} page={{ id: 'mini', background: { type: 'none' }, elements: [{ ...el, id: el.id }] }} width="100%" height="100%" uidPrefix={`mini-${el.id}-`} />;
}

function TemplateTile({ t, onClick }) {
  const [d, setD] = useState(null);
  useEffect(() => setD(templateDesign(t)), [t]);
  return (
    <button className="tpl" onClick={onClick}>
      {d ? <DesignPage design={d} page={d.pages[0]} width="100%" height={undefined} uidPrefix={`et-${t.id}-`} /> : <div style={{ aspectRatio: `${t.width}/${t.height}` }} />}
      <span>{t.name}{d && d.pages.length > 1 ? ` · ${d.pages.length} pages` : ''}</span>
    </button>
  );
}

function UserTemplates({ onPick }) {
  const [scope, setScope] = useState('mine');
  const [list, setList] = useState(null);
  useEffect(() => {
    setList(null);
    // Documents never get a picture thumbnail, so anything without data.kind === 'doc' is a design.
    fetch(`/api/templates?scope=${scope}`).then((r) => r.json()).then((d) => setList((d.templates || []).filter((t) => t.data?.kind !== 'doc'))).catch(() => setList([]));
  }, [scope]);
  return (
    <>
      <div className="row" style={{ marginTop: 18 }}>
        <h4 className="grow" style={{ margin: 0 }}>{scope === 'mine' ? 'Your templates' : 'Community templates'}</h4>
        <button className="btn btn-sm" onClick={() => setScope(scope === 'mine' ? 'community' : 'mine')}>{scope === 'mine' ? 'Community →' : '← Yours'}</button>
      </div>
      {!list ? <p className="small muted">Loading…</p> : !list.length ? (
        <p className="small muted">{scope === 'mine' ? 'None yet. Press 📌 Template at the top to save this design as one.' : 'No community templates yet.'}</p>
      ) : (
        <div className="tile-grid cols-2" style={{ marginTop: 8 }}>
          {list.map((t) => (
            <button key={t.id} className="tpl" title={`${t.title}${scope === 'community' ? ` by @${t.username}` : ''}`}
              onClick={async () => {
                const r = await fetch(`/api/designs/${t.id}`);
                const d = await r.json().catch(() => ({}));
                if (r.ok && d.design?.data?.pages) onPick(d.design.data);
              }}>
              {t.thumb
                ? <img src={t.thumb} alt="" loading="lazy" style={{ width: '100%', display: 'block' }} />
                : t.data?.pages ? <DesignPage design={t.data} page={t.data.pages[0]} width="100%" uidPrefix={`ut-${t.id}-`} /> : null}
              <span>{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

const UNITS = { px: 1, in: 96, cm: 37.7953, mm: 3.77953 };

function ResizeMenu({ W, H, onApply, onCopy, onClose }) {
  const [w, setW] = useState(W);
  const [h, setH] = useState(H);
  const [unit, setUnit] = useState('px');
  const [lock, setLock] = useState(false);
  const [scale, setScale] = useState(true);
  const [busy, setBusy] = useState(false);
  const u = UNITS[unit];
  const show = (v) => Math.round((v / u) * 100) / 100;
  const setWidth = (v) => { const px = v * u; if (lock && w) setH(Math.round((h * px) / w)); setW(Math.round(px)); };
  const setHeight = (v) => { const px = v * u; if (lock && h) setW(Math.round((w * px) / h)); setH(Math.round(px)); };
  const ok = w >= 16 && h >= 16 && w <= 8000 && h <= 8000;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>Resize design</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field grow">Width<input className="input" type="number" step="any" value={show(w)} onChange={(e) => setWidth(Number(e.target.value))} /></label>
            <button className={`btn btn-sm ${lock ? 'active' : ''}`} title="Keep proportions" onClick={() => setLock(!lock)}>{lock ? '🔗' : '⛓️‍💥'}</button>
            <label className="field grow">Height<input className="input" type="number" step="any" value={show(h)} onChange={(e) => setHeight(Number(e.target.value))} /></label>
            <label className="field">Units
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 80 }}>
                {Object.keys(UNITS).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <button className="btn btn-sm" title="Swap width and height" onClick={() => { setW(h); setH(w); }}>⇄</button>
          </div>
          <div className="small muted">{w} × {h} px{!ok ? ' · must be between 16 and 8000 px' : ''}</div>
          <label className="row small"><input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} /> Scale everything to fit the new size</label>
          <div style={{ maxHeight: 280, overflow: 'auto' }}>
            {PRESET_GROUPS.map((g) => (
              <div key={g.name}>
                <h4 style={{ margin: '10px 0 6px' }}>{g.name}</h4>
                <div className="row wrap" style={{ gap: 6 }}>
                  {g.items.map((p) => <button key={p.name} className={`btn btn-sm ${p.w === w && p.h === h ? 'active' : ''}`} onClick={() => { setW(p.w); setH(p.h); }}>{p.icon} {p.name}</button>)}
                </div>
              </div>
            ))}
          </div>
          <div className="row wrap">
            <div className="grow" />
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={!ok || busy} title="Keeps this design as it is and opens a resized copy in a new tab" onClick={async () => { setBusy(true); await onCopy(w, h); setBusy(false); }}>{busy ? 'Copying…' : '⧉ Resize a copy'}</button>
            <button className="btn btn-primary" disabled={!ok} onClick={() => onApply(w, h, scale)}>Resize</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Props({ el, update, actions, onFont, k, fonts = FONTS, colors = [], isVideo, onPreview, isSite, pages = [], canAnimate, recolorIcon }) {
  const f = el.filters || {};
  const sh = el.shadow || {};
  const an = el.anim || {};
  return (
    <>
      {canAnimate ? (
        <>
          <h4>{isVideo ? 'Animation' : 'Animation (when presenting)'}</h4>
          <div className="prop">
            <label style={{ gridColumn: 'span 2' }}>How it appears
              <select value={an.type || 'none'} onChange={(e) => update({ anim: { duration: 0.7, delay: 0, ...an, type: e.target.value } })}>
                {ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {an.type && an.type !== 'none' ? (
            <>
              <Range label="Delay" min={0} max={10} step={0.1} value={Number(an.delay) || 0} suffix="s" onChange={(v) => update({ anim: { ...an, delay: v } })} />
              <Range label="Speed" min={0.1} max={4} step={0.1} value={Number(an.duration) || 0.7} suffix="s" onChange={(v) => update({ anim: { ...an, duration: v } })} />
            </>
          ) : null}
          <button className="btn btn-sm" onClick={onPreview} style={{ marginTop: 4 }}>{isVideo ? '▶ Preview scene' : '▶ Present from here'}</button>
        </>
      ) : null}
      {el.type === 'text' ? (
        <>
          <div className="row"><h4 className="grow" style={{ margin: 0 }}>Text</h4><button className="btn btn-sm" onClick={actions.aiText}>✨ Rewrite with AI</button></div>
          <textarea className="input" rows={3} value={el.text} onChange={(e) => update({ text: e.target.value })} style={{ marginTop: 8 }} />
          <div className="prop" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 2' }}>Font
              <select value={el.fontFamily} onChange={(e) => { update({ fontFamily: e.target.value }); onFont({ ...el, fontFamily: e.target.value }); }} style={{ fontFamily: el.fontFamily }}>
                {[...new Set([...fonts, el.fontFamily])].map((fnt) => <option key={fnt} value={fnt} style={{ fontFamily: fnt }}>{fnt}</option>)}
              </select>
            </label>
            <Num label="Size" value={el.fontSize} min={1} onChange={(v) => update({ fontSize: Math.max(1, v) })} />
            <label>Weight
              <select value={el.fontWeight || 400} onChange={(e) => { const fw = Number(e.target.value); update({ fontWeight: fw }); onFont({ ...el, fontWeight: fw }); }}>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}{w === 400 ? ' (normal)' : w === 700 ? ' (bold)' : ''}</option>)}
              </select>
            </label>
            <Num label="Line height" value={el.lineHeight} step={0.05} onChange={(v) => update({ lineHeight: Math.max(0.5, v) })} />
            <Num label="Letter spacing" value={el.letterSpacing || 0} onChange={(v) => update({ letterSpacing: v })} />
          </div>
          <ColorRow label="Text color" value={el.color} onChange={(c) => update({ color: c })} colors={colors} />
          <div className="toggle-row">
            <button className={`btn ${el.fontWeight >= 700 ? 'active' : ''}`} onClick={() => { const fw = el.fontWeight >= 700 ? 400 : 700; update({ fontWeight: fw }); onFont({ ...el, fontWeight: fw }); }}><b>B</b></button>
            <button className={`btn ${el.italic ? 'active' : ''}`} onClick={() => update({ italic: !el.italic })}><i>I</i></button>
            <button className={`btn ${el.underline ? 'active' : ''}`} onClick={() => update({ underline: !el.underline })}><u>U</u></button>
            <button className={`btn ${el.uppercase ? 'active' : ''}`} onClick={() => update({ uppercase: !el.uppercase })}>aA</button>
            {['left', 'center', 'right'].map((a) => (
              <button key={a} className={`btn ${el.align === a ? 'active' : ''}`} onClick={() => update({ align: a })}>{a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}</button>
            ))}
          </div>
          <h4>Text effects</h4>
          <div className="toggle-row">
            <button className={`btn ${el.strokeWidth ? 'active' : ''}`} onClick={() => update({ strokeWidth: el.strokeWidth ? 0 : Math.max(1, el.fontSize / 20), stroke: el.stroke || '#000000' })}>Outline</button>
            <button className={`btn ${el.bgColor ? 'active' : ''}`} onClick={() => update({ bgColor: el.bgColor ? '' : '#fde047' })}>Highlight</button>
          </div>
          {el.strokeWidth ? <><ColorRow label="Outline color" value={el.stroke} onChange={(c) => update({ stroke: c })} colors={colors} /><Range label="Outline" min={0.5} max={Math.max(10, el.fontSize / 5)} step={0.5} value={el.strokeWidth} onChange={(v) => update({ strokeWidth: v })} /></> : null}
          {el.bgColor ? <ColorRow label="Highlight color" value={el.bgColor} onChange={(c) => update({ bgColor: c })} colors={colors} /> : null}
        </>
      ) : null}

      {el.type === 'shape' ? (
        <>
          <h4>Shape</h4>
          <ColorRow label="Fill" value={el.fill} onChange={(c) => update({ fill: c })} colors={colors} />
          <div className="toggle-row">
            <button className={`btn ${!el.fill ? 'active' : ''}`} onClick={() => update({ fill: el.fill ? '' : '#1f9d5a' })}>No fill</button>
            <button className={`btn ${el.gradient ? 'active' : ''}`} onClick={() => update({ gradient: el.gradient ? '' : '#3ddc84', fill: el.fill || '#1f9d5a' })}>Gradient</button>
          </div>
          {el.gradient ? (
            <>
              <ColorRow label="Gradient to" value={el.gradient} onChange={(c) => update({ gradient: c })} colors={colors} />
              <Range label="Angle" min={0} max={360} value={el.gradientAngle ?? 135} onChange={(v) => update({ gradientAngle: v })} suffix="°" />
            </>
          ) : null}
          <ColorRow label="Border" value={el.stroke} onChange={(c) => update({ stroke: c })} colors={colors} />
          <Range label="Border width" min={0} max={Math.max(40, 60 * k)} value={el.strokeWidth || 0} onChange={(v) => update({ strokeWidth: v })} />
          {el.strokeWidth ? (
            <div className="toggle-row">
              {[['solid', '━ Solid'], ['dashed', '╌ Dashed'], ['dotted', '┈ Dotted']].map(([v, l]) => (
                <button key={v} className={`btn ${(el.borderStyle || 'solid') === v ? 'active' : ''}`} onClick={() => update({ borderStyle: v })}>{l}</button>
              ))}
            </div>
          ) : null}
          {el.shape === 'rect' ? <Range label="Corners" min={0} max={Math.min(el.w, el.h) / 2} value={el.radius || 0} onChange={(v) => update({ radius: v })} /> : null}
          {el.shape === 'star' ? <Range label="Points" min={3} max={12} value={el.points || 5} onChange={(v) => update({ points: v })} /> : null}
        </>
      ) : null}

      {el.type === 'line' ? (
        <>
          <h4>Line</h4>
          <ColorRow label="Color" value={el.stroke} onChange={(c) => update({ stroke: c })} colors={colors} />
          <Range label="Thickness" min={1} max={Math.max(40, 60 * k)} value={el.strokeWidth} onChange={(v) => update({ strokeWidth: v, h: Math.max(el.h, v * 2.2) })} />
          <div className="toggle-row">
            <button className={`btn ${el.dash ? 'active' : ''}`} onClick={() => update({ dash: !el.dash })}>Dashed</button>
            <button className={`btn ${el.arrow ? 'active' : ''}`} onClick={() => update({ arrow: !el.arrow, h: Math.max(el.h, el.strokeWidth * 4.4) })}>Arrow</button>
          </div>
        </>
      ) : null}

      {el.type === 'image' ? (
        <>
          {el.icon && el.iconColor ? (
            <>
              <h4>Icon</h4>
              <ColorRow label="Icon color" value={el.iconColor} onChange={recolorIcon} colors={colors} />
            </>
          ) : null}
          <h4>{el.icon ? 'Image' : 'Photo'}</h4>
          <div className="toggle-row">
            <button className="btn" onClick={actions.replace}>Replace</button>
            <button className="btn" onClick={actions.setBg}>Set as background</button>
            <button className={`btn ${el.flipX ? 'active' : ''}`} onClick={() => update({ flipX: !el.flipX })}>⇋ Flip</button>
            <button className={`btn ${el.flipY ? 'active' : ''}`} onClick={() => update({ flipY: !el.flipY })}>⇵ Flip</button>
            <button className={`btn ${el.fit === 'contain' ? 'active' : ''}`} onClick={() => update({ fit: el.fit === 'contain' ? 'cover' : 'contain' })}>Fit whole</button>
          </div>
          {!el.icon ? <button className="btn btn-sm" style={{ marginTop: 6, width: '100%' }} onClick={actions.removeBg}>✂️ Remove background</button> : null}
          <h4>Rounded corners</h4>
          <Range label="Corners" min={0} max={Math.round(Math.min(el.w, el.h) / 2)} value={Math.round(el.radius || 0)} onChange={(v) => update({ radius: v })} />
          <div className="toggle-row">
            {[['Square', 0], ['Rounded', 0.08], ['More', 0.2], ['Circle', 0.5]].map(([n, f]) => (
              <button key={n} className={`btn ${Math.round(el.radius || 0) === Math.round(Math.min(el.w, el.h) * f) ? 'active' : ''}`} onClick={() => update({ radius: Math.min(el.w, el.h) * f })}>{n}</button>
            ))}
          </div>
          {el.fit !== 'contain' ? (
            <>
              <div className="small muted" style={{ marginTop: 6 }}>Focus (which part stays in frame)</div>
              <div className="focus-grid">
                {FOCUS.map(([v, i]) => <button key={v} className={`btn ${(el.focus || 'xMidYMid') === v ? 'active' : ''}`} onClick={() => update({ focus: v })}>{i}</button>)}
              </div>
            </>
          ) : null}
          {el.credit ? <div className="small muted" style={{ marginTop: 6 }}>📷 {el.credit}</div> : null}
          <h4>Filters</h4>
          <div className="toggle-row">
            {[['Original', {}], ['B&W', { grayscale: 100 }], ['Vintage', { sepia: 60, contrast: 110 }], ['Vivid', { saturate: 160, contrast: 110 }], ['Cool', { hue: 190, saturate: 80 }], ['Fade', { brightness: 115, contrast: 80, saturate: 70 }]].map(([n, v]) => (
              <button key={n} className="btn" onClick={() => update({ filters: v })}>{n}</button>
            ))}
          </div>
          <Range label="Brightness" min={0} max={200} value={f.brightness ?? 100} onChange={(v) => update({ filters: { ...f, brightness: v } })} suffix="%" />
          <Range label="Contrast" min={0} max={200} value={f.contrast ?? 100} onChange={(v) => update({ filters: { ...f, contrast: v } })} suffix="%" />
          <Range label="Saturation" min={0} max={300} value={f.saturate ?? 100} onChange={(v) => update({ filters: { ...f, saturate: v } })} suffix="%" />
          <Range label="Grayscale" min={0} max={100} value={f.grayscale ?? 0} onChange={(v) => update({ filters: { ...f, grayscale: v } })} suffix="%" />
          <Range label="Sepia" min={0} max={100} value={f.sepia ?? 0} onChange={(v) => update({ filters: { ...f, sepia: v } })} suffix="%" />
          <Range label="Hue" min={0} max={360} value={f.hue ?? 0} onChange={(v) => update({ filters: { ...f, hue: v } })} suffix="°" />
          <Range label="Blur" min={0} max={20} step={0.5} value={f.blur ?? 0} onChange={(v) => update({ filters: { ...f, blur: v } })} suffix="px" />
          <ColorRow label="Border" value={el.stroke || '#000000'} onChange={(c) => update({ stroke: c })} colors={colors} />
          <Range label="Border width" min={0} max={40} value={el.strokeWidth || 0} onChange={(v) => update({ strokeWidth: v })} />
        </>
      ) : null}

      {el.type === 'draw' ? (
        <>
          <h4>Pen stroke</h4>
          <ColorRow label="Color" value={el.stroke} onChange={(c) => update({ stroke: c })} colors={colors} />
          <Range label="Thickness" min={1} max={Math.max(40, 60 * k)} value={el.strokeWidth || 6} onChange={(v) => update({ strokeWidth: v })} />
        </>
      ) : null}

      {el.type === 'video' ? (
        <>
          <h4>Video clip</h4>
          <div className="small muted">{Math.round((Number(el.duration) || 0) * 10) / 10}s long · plays for {Math.round(clipLength(el) * 10) / 10}s</div>
          <div className="prop" style={{ marginTop: 6 }}>
            <Num label="Start at (s)" value={Number(el.trimStart) || 0} step={0.1} min={0} onChange={(v) => update({ trimStart: Math.max(0, Math.min(v, (Number(el.trimEnd) || Number(el.duration) || v + 1) - 0.1)) })} />
            <Num label="End at (s)" value={Number(el.trimEnd) || Number(el.duration) || 0} step={0.1} min={0} onChange={(v) => update({ trimEnd: Math.max((Number(el.trimStart) || 0) + 0.1, Math.min(v, Number(el.duration) || v)) })} />
          </div>
          <div className="toggle-row">
            <button className={`btn ${el.muted ? 'active' : ''}`} onClick={() => update({ muted: !el.muted })}>{el.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
            <button className={`btn ${el.loop ? 'active' : ''}`} onClick={() => update({ loop: !el.loop })}>🔁 Loop</button>
            <button className={`btn ${el.fit === 'contain' ? 'active' : ''}`} onClick={() => update({ fit: el.fit === 'contain' ? 'cover' : 'contain' })}>Fit whole</button>
          </div>
          {!el.muted ? <Range label="Volume" min={0} max={100} value={Math.round((el.volume ?? 1) * 100)} suffix="%" onChange={(v) => update({ volume: v / 100 })} /> : null}
          <Range label="Corners" min={0} max={Math.round(Math.min(el.w, el.h) / 2)} value={Math.round(el.radius || 0)} onChange={(v) => update({ radius: v })} />
          {actions.fitScene ? <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={actions.fitScene}>Make the scene as long as the clip</button> : null}
          {!isVideo ? <div className="small muted" style={{ marginTop: 6 }}>Plays when presenting, on the view page and on websites.</div> : null}
        </>
      ) : null}

      {el.type === 'audio' ? (
        <>
          <h4>Sound</h4>
          <div className="small muted">{el.name}{el.duration ? ` · ${Math.round(el.duration)}s` : ''}</div>
          <ColorRow label="Button color" value={el.color} onChange={(c) => update({ color: c })} colors={colors} />
          <div className="toggle-row"><button className={`btn ${el.loop ? 'active' : ''}`} onClick={() => update({ loop: !el.loop })}>🔁 Loop</button></div>
          <div className="small muted" style={{ marginTop: 6 }}>A play button when presenting, on the view page and on websites.</div>
        </>
      ) : null}

      {el.type === 'chart' || el.type === 'table' || el.type === 'qr' ? <BlockProps el={el} update={update} fonts={fonts} colors={colors} onFont={onFont} /> : null}

      <h4>{isSite ? 'When clicked, go to' : 'Link'}</h4>
      <LinkPicker value={el.link || ''} onChange={(link) => update({ link })} pages={pages} isSite={isSite} />

      <h4>Look</h4>
      <Range label="Transparency" min={0} max={100} value={Math.round((1 - (el.opacity ?? 1)) * 100)} onChange={(v) => update({ opacity: 1 - v / 100 })} suffix="%" />
      <div className="prop">
        <label style={{ gridColumn: 'span 2' }}>Blend mode
          <select value={el.blend || 'normal'} onChange={(e) => update({ blend: e.target.value })}>
            {BLENDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      </div>
      <div className="toggle-row">
        <button className={`btn ${sh.on ? 'active' : ''}`} onClick={() => update({ shadow: { x: 6 * k, y: 10 * k, blur: 20 * k, color: 'rgba(0,0,0,0.35)', ...sh, on: !sh.on } })}>Shadow</button>
      </div>
      {sh.on ? (
        <>
          <Range label="Shadow blur" min={0} max={100} value={sh.blur ?? 12} onChange={(v) => update({ shadow: { ...sh, blur: v } })} />
          <Range label="Offset X" min={-60} max={60} value={sh.x ?? 4} onChange={(v) => update({ shadow: { ...sh, x: v } })} />
          <Range label="Offset Y" min={-60} max={60} value={sh.y ?? 6} onChange={(v) => update({ shadow: { ...sh, y: v } })} />
        </>
      ) : null}

      <h4>Position</h4>
      <div className="prop">
        <Num label="X" value={el.x} onChange={(v) => update({ x: v })} />
        <Num label="Y" value={el.y} onChange={(v) => update({ y: v })} />
        <Num label="Width" value={el.w} min={1} onChange={(v) => update({ w: Math.max(1, v) })} />
        {el.type === 'text' ? <label>Height<input disabled readOnly value={Math.round(el.h)} /></label> : <Num label="Height" value={el.h} min={1} onChange={(v) => update({ h: Math.max(1, v) })} />}
        <Num label="Rotation°" value={el.rotation || 0} onChange={(v) => update({ rotation: v })} />
      </div>
      <div className="toggle-row" style={{ marginTop: 8 }}>
        {[['left', '⇤'], ['center', '↔'], ['right', '⇥'], ['top', '⤒'], ['middle', '↕'], ['bottom', '⤓']].map(([a, i]) => (
          <button key={a} className="btn" title={`Align ${a}`} onClick={() => actions.alignSel(a)}>{i}</button>
        ))}
      </div>
      <h4>Arrange</h4>
      <div className="toggle-row">
        <button className="btn" onClick={() => actions.reorder('front')}>To front</button>
        <button className="btn" onClick={() => actions.reorder('up')}>Forward</button>
        <button className="btn" onClick={() => actions.reorder('down')}>Backward</button>
        <button className="btn" onClick={() => actions.reorder('back')}>To back</button>
      </div>
      <div className="toggle-row">
        <button className={`btn ${el.locked ? 'active' : ''}`} onClick={() => update({ locked: !el.locked })}>{el.locked ? '🔒 Locked' : '🔓 Lock'}</button>
        <button className="btn" onClick={actions.duplicateSel}>⧉ Duplicate</button>
        <button className="btn btn-danger" onClick={actions.deleteSel}>🗑 Delete</button>
      </div>
    </>
  );
}

/** Settings for charts, tables and QR codes. */
function BlockProps({ el, update, fonts, colors, onFont }) {
  const [csv, setCsv] = useState(() => (el.type === 'chart' ? chartToCsv(el.chart) : ''));
  const [csvFor, setCsvFor] = useState(el.id);
  if (csvFor !== el.id) { setCsvFor(el.id); setCsv(el.type === 'chart' ? chartToCsv(el.chart) : ''); }
  const fontRow = (
    <div className="prop">
      <label style={{ gridColumn: 'span 2' }}>Font
        <select value={el.fontFamily || 'Inter'} onChange={(e) => { update({ fontFamily: e.target.value }); onFont({ fontFamily: e.target.value, fontWeight: 400 }); }} style={{ fontFamily: el.fontFamily }}>
          {[...new Set([...fonts, el.fontFamily || 'Inter'])].map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </label>
      <Num label="Text size (0 = auto)" value={el.fontSize || 0} min={0} onChange={(v) => update({ fontSize: v > 0 ? v : undefined })} />
    </div>
  );

  if (el.type === 'qr') {
    return (
      <>
        <h4>QR code</h4>
        <label className="field small">Link or text
          <input className="input" value={el.text || ''} onChange={(e) => update({ text: e.target.value.slice(0, 1200) })} placeholder="https://…" />
        </label>
        <ColorRow label="Color" value={el.color} onChange={(c) => update({ color: c })} colors={colors} />
        <div className="toggle-row">
          <button className={`btn ${el.bg ? 'active' : ''}`} onClick={() => update({ bg: el.bg ? '' : '#ffffff' })}>Background</button>
        </div>
        {el.bg ? <ColorRow label="Background" value={el.bg} onChange={(c) => update({ bg: c })} colors={colors} /> : null}
        {el.bg ? <Range label="Corners" min={0} max={Math.round(Math.min(el.w, el.h) / 4)} value={Math.round(el.radius || 0)} onChange={(v) => update({ radius: v })} /> : null}
        <p className="small muted">Keep good contrast (dark on light) so phones can scan it.</p>
      </>
    );
  }

  if (el.type === 'chart') {
    const c = el.chart || {};
    const pie = c.type === 'pie' || c.type === 'donut';
    const setC = (patch) => update({ chart: { ...c, ...patch } });
    return (
      <>
        <h4>Chart</h4>
        <div className="toggle-row">
          {CHART_TYPES.map(([t, n]) => <button key={t} className={`btn ${(c.type || 'bar') === t ? 'active' : ''}`} onClick={() => setC({ type: t })}>{n}</button>)}
        </div>
        <label className="field small" style={{ marginTop: 8 }}>Title
          <input className="input" value={c.title || ''} onChange={(e) => setC({ title: e.target.value.slice(0, 120) })} placeholder="(none)" />
        </label>
        <label className="field small" style={{ marginTop: 8 }}>Data — first line is the names, then one line per item
          <textarea className="input mono" rows={6} value={csv} onChange={(e) => { setCsv(e.target.value); update({ chart: csvToChart(e.target.value, c) }); }} />
        </label>
        <div className="small muted">Like a spreadsheet: <code>Month, Sales, Costs</code> then <code>Jan, 12, 8</code>. You can paste from a spreadsheet too.</div>
        {pie ? (
          <>
            <h4>Slice colors</h4>
            {(c.labels || []).slice(0, 12).map((l, i) => (
              <ColorRow key={i} label={l || `Slice ${i + 1}`} value={c.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length]}
                onChange={(col) => { const cols = [...(c.colors || [])]; for (let j = 0; j <= i; j++) cols[j] = cols[j] || CHART_COLORS[j % CHART_COLORS.length]; cols[i] = col; setC({ colors: cols }); }} />
            ))}
          </>
        ) : (
          <>
            <h4>Series colors</h4>
            {(c.series || []).map((s, i) => (
              <ColorRow key={i} label={s.name} value={s.color || CHART_COLORS[i % CHART_COLORS.length]} colors={colors}
                onChange={(col) => setC({ series: c.series.map((x, j) => (j === i ? { ...x, color: col } : x)) })} />
            ))}
          </>
        )}
        <div className="toggle-row" style={{ marginTop: 8 }}>
          <button className={`btn ${c.legend !== false ? 'active' : ''}`} onClick={() => setC({ legend: c.legend === false })}>Legend</button>
          <button className={`btn ${pie ? c.values !== false ? 'active' : '' : c.values ? 'active' : ''}`} onClick={() => setC({ values: pie ? c.values === false : !c.values })}>Numbers</button>
          <button className={`btn ${el.bg ? 'active' : ''}`} onClick={() => update({ bg: el.bg ? '' : '#ffffff' })}>Card</button>
        </div>
        <ColorRow label="Text color" value={el.color} onChange={(col) => update({ color: col })} colors={colors} />
        {el.bg ? <ColorRow label="Card color" value={el.bg} onChange={(col) => update({ bg: col })} colors={colors} /> : null}
        {el.bg ? <Range label="Card corners" min={0} max={Math.round(Math.min(el.w, el.h) / 6)} value={Math.round(el.radius || 0)} onChange={(v) => update({ radius: v })} /> : null}
        {fontRow}
      </>
    );
  }

  // table
  const rows = Array.isArray(el.rows) && el.rows.length ? el.rows : [['']];
  const nc = Math.max(1, ...rows.map((r) => r.length));
  const setCell = (r, c, v) => update({ rows: rows.map((row, i) => (i === r ? Array.from({ length: nc }, (_, j) => (j === c ? v : row[j] ?? '')) : row)) });
  const grow = (dr, dc) => {
    let next = rows.map((r) => Array.from({ length: nc }, (_, j) => r[j] ?? ''));
    if (dr > 0) next.push(Array(nc).fill(''));
    if (dr < 0 && next.length > 1) next.pop();
    if (dc > 0) next = next.map((r) => [...r, '']);
    if (dc < 0 && nc > 1) next = next.map((r) => r.slice(0, -1));
    const rh = el.h / rows.length;
    update({ rows: next, h: dr ? Math.max(20, el.h + dr * rh) : el.h });
  };
  return (
    <>
      <h4>Table</h4>
      <div className="table-edit" style={{ gridTemplateColumns: `repeat(${nc}, minmax(60px, 1fr))` }}>
        {rows.map((row, r) => Array.from({ length: nc }, (_, c) => (
          <input key={`${r}-${c}`} className={r === 0 && el.header !== false ? 'head' : ''} value={row[c] ?? ''} onChange={(e) => setCell(r, c, e.target.value.slice(0, 200))} />
        )))}
      </div>
      <div className="toggle-row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => grow(1, 0)}>＋ Row</button>
        <button className="btn" disabled={rows.length < 2} onClick={() => grow(-1, 0)}>− Row</button>
        <button className="btn" disabled={nc >= 12} onClick={() => grow(0, 1)}>＋ Column</button>
        <button className="btn" disabled={nc < 2} onClick={() => grow(0, -1)}>− Column</button>
      </div>
      <div className="toggle-row" style={{ marginTop: 6 }}>
        <button className={`btn ${el.header !== false ? 'active' : ''}`} onClick={() => update({ header: el.header === false })}>Header row</button>
        <button className={`btn ${el.stripe ? 'active' : ''}`} onClick={() => update({ stripe: el.stripe ? '' : '#f4f5f7' })}>Stripes</button>
        <button className={`btn ${el.border ? 'active' : ''}`} onClick={() => update({ border: el.border ? '' : '#dfe2e7' })}>Lines</button>
        <button className={`btn ${el.grid !== false ? 'active' : ''}`} onClick={() => update({ grid: el.grid === false })}>Column lines</button>
      </div>
      <div className="toggle-row">
        {['left', 'center', 'right'].map((a) => <button key={a} className={`btn ${(el.align || 'left') === a ? 'active' : ''}`} onClick={() => update({ align: a })}>{a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}</button>)}
      </div>
      {el.header !== false ? <ColorRow label="Header" value={el.headerBg} onChange={(c) => update({ headerBg: c })} colors={colors} /> : null}
      {el.header !== false ? <ColorRow label="Header text" value={el.headerColor} onChange={(c) => update({ headerColor: c })} colors={colors} /> : null}
      <ColorRow label="Text" value={el.color} onChange={(c) => update({ color: c })} colors={colors} />
      <ColorRow label="Cells" value={el.cellBg} onChange={(c) => update({ cellBg: c })} colors={colors} />
      {el.stripe ? <ColorRow label="Stripes" value={el.stripe} onChange={(c) => update({ stripe: c })} colors={colors} /> : null}
      {el.border ? <ColorRow label="Lines" value={el.border} onChange={(c) => update({ border: c })} colors={colors} /> : null}
      <Range label="Corners" min={0} max={Math.round(Math.min(el.w, el.h) / 4)} value={Math.round(el.radius || 0)} onChange={(v) => update({ radius: v })} />
      {fontRow}
    </>
  );
}
