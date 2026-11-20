'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DesignPage from './DesignPage';
import Presenter from './Presenter';
import ShareModal from './ShareModal';
import {
  EMOJI, FONTS, GRADIENTS, PRESET_GROUPS, SWATCHES, blankPage, emojiEl, imageEl, lineEl, normalizeDesign,
  scalePage, shapeEl, textEl, textFont, textHeight, uid, wrapText,
} from '@/lib/design';
import { TEMPLATES, templateDesign } from '@/lib/templates';
import { ensureFonts, exportImage, exportJson, exportPdf, exportSvg, fileToDataUrl } from '@/lib/export';

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
  ['elements', '🔷', 'Elements'],
  ['text', '🔤', 'Text'],
  ['uploads', '☁️', 'Uploads'],
  ['background', '🎨', 'Background'],
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

function ColorRow({ label, value, onChange }) {
  const v = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return (
    <div className="color-row">
      <input type="color" value={v} onChange={(e) => onChange(e.target.value)} />
      <span className="grow">{label}</span>
      <input className="input" style={{ width: 92, padding: '5px 8px', fontSize: 12 }} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function Editor({ id, initialDesign, initialTitle, initialVisibility, role }) {
  const [design, setDesign] = useState(() => normalizeDesign(initialDesign));
  const designRef = useRef(design);
  const past = useRef([]);
  const future = useRef([]);
  const [, force] = useState(0);
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [pageIdx, setPageIdx] = useState(0);
  const [selId, setSelId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [panel, setPanel] = useState('templates');
  const [zoom, setZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);
  const [save, setSave] = useState('saved');
  const [modal, setModal] = useState(null); // 'share' | 'download' | 'resize' | 'present'
  const [guides, setGuides] = useState([]);
  const [busy, setBusy] = useState('');
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
    ensureFonts(designRef.current).then(() => {
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

  // ---------- saving ----------
  const doSave = useCallback(async () => {
    if (saving.current) { dirty.current = true; return; }
    saving.current = true;
    dirty.current = false;
    setSave('saving');
    try {
      const body = JSON.stringify({ design: designRef.current, title: titleRef.current });
      if (body.length > 4_300_000) { setSave('toobig'); return; }
      const r = await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      setSave(r.ok ? 'saved' : 'error');
    } catch {
      setSave('error');
    } finally {
      saving.current = false;
      if (dirty.current) doSave();
    }
  }, [id]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSave('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 900);
  }, [design, title, doSave]);

  useEffect(() => {
    const warn = (e) => { if (save !== 'saved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  async function saveNow() {
    clearTimeout(saveTimer.current);
    await doSave();
  }

  async function changeVisibility(v) {
    setVisibility(v);
    await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) });
  }

  // ---------- uploads ----------
  async function addFiles(files, { insert = true } = {}) {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
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
    const s = Math.min((W * 0.6) / a.width, (H * 0.6) / a.height);
    addEl(imageEl({ src: a.src, w: a.width * s, h: a.height * s }));
  };

  // ---------- keyboard + clipboard ----------
  useEffect(() => {
    const onKey = (e) => {
      if (modal === 'present') return;
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
      if (e.key === 'Escape') { setSelId(null); setEditingId(null); return; }
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

  function onCanvasDown(e) {
    if (e.button !== 0) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.classList?.contains('handle')) return;
    const target = e.target.closest?.('[data-id]');
    if (!target) { setSelId(null); setEditingId(null); return; }
    const eid = target.getAttribute('data-id');
    const el = page.elements.find((x) => x.id === eid);
    if (!el) return;
    if (editingId && editingId !== eid) setEditingId(null);
    setSelId(eid);
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
  const saveLabel = { saved: '✓ Saved', saving: 'Saving…', unsaved: 'Unsaved', error: '⚠ Save failed', toobig: '⚠ Too big to save (use smaller images)' }[save];

  return (
    <div className="editor">
      {/* ---------- top bar ---------- */}
      <div className="ed-top">
        <Link href="/" className="btn btn-sm" title="Home">🏠</Link>
        <button className="btn btn-sm" onClick={() => setModal(modal === 'resize' ? null : 'resize')}>📐 Resize</button>
        <button className="btn btn-sm" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)">↶</button>
        <button className="btn btn-sm" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)">↷</button>
        <input className="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Design title" />
        <span className="ed-status" title={save === 'error' ? 'Click to retry' : ''} onClick={() => save === 'error' && saveNow()}>{busy || saveLabel}</span>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => setModal('present')}>▶ Present</button>
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
              <button onClick={() => runExport('json')}>💾 Jace Design file <small>re-import later</small></button>
            </div>
          ) : null}
        </div>
        <button className="btn btn-sm btn-white" onClick={() => setModal('share')}>🔗 Share</button>
      </div>

      {modal === 'resize' ? <ResizeMenu W={W} H={H} onApply={resizeDesign} onClose={() => setModal(null)} /> : null}

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
            </>
          ) : null}

          {panel === 'elements' ? (
            <>
              <h4>Shapes</h4>
              <div className="tile-grid">
                {SHAPES.map(([shape, o], i) => {
                  const el = shapeEl(shape, { x: 10, y: shape === 'arrow' ? 30 : 10, w: 80, h: shape === 'arrow' ? 40 : 80, ...o, strokeWidth: o.strokeWidth ? 6 : 0, radius: o.radius ? 18 : 0 });
                  return (
                    <button key={i} className="tile" onClick={() => addEl(shapeEl(shape, { w: 300 * k, h: (o.h || 300) * k, fill: o.fill ?? '#7c3aed', stroke: o.stroke || '#000000', strokeWidth: (o.strokeWidth || 0) * k, radius: (o.radius || 0) * k }))}>
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
              <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => addEl(textEl({ text: 'Your text here', fontSize: 48 * k, w: 600 * k }))}>T  Add a text box</button>
              <h4>Default styles</h4>
              <button className="text-preset" onClick={() => addEl(textEl({ text: 'Add a heading', fontFamily: 'Poppins', fontWeight: 700, fontSize: 110 * k, w: Math.min(W * 0.9, 1000 * k), align: 'center' }))}><span style={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 24 }}>Add a heading</span></button>
              <button className="text-preset" onClick={() => addEl(textEl({ text: 'Add a subheading', fontFamily: 'Poppins', fontWeight: 400, fontSize: 64 * k, w: Math.min(W * 0.9, 800 * k), align: 'center' }))}><span style={{ fontFamily: 'Poppins', fontSize: 18 }}>Add a subheading</span></button>
              <button className="text-preset" onClick={() => addEl(textEl({ text: 'Add a little bit of body text', fontSize: 36 * k, w: Math.min(W * 0.9, 700 * k), align: 'center' }))}><span style={{ fontSize: 13 }}>Add a little bit of body text</span></button>
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
            </>
          ) : null}

          {panel === 'uploads' ? (
            <>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => uploadRef.current?.click()}>☁️ Upload images</button>
              <input ref={uploadRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <p className="small muted">You can also drag images onto the canvas, or paste them with Ctrl/⌘+V.</p>
              <h4>Your uploads</h4>
              {design.assets?.length ? (
                <div className="tile-grid cols-2">
                  {design.assets.map((a) => (
                    <div key={a.id} style={{ position: 'relative' }}>
                      <button className="tile" style={{ padding: 0, width: '100%' }} onClick={() => insertAsset(a)} title="Add to page">
                        <img src={a.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                      <div className="row" style={{ position: 'absolute', bottom: 4, right: 4, gap: 4 }}>
                        <button className="btn btn-sm" style={{ padding: '2px 6px' }} title="Use as background" onClick={() => setBg({ type: 'image', src: a.src, color: '#ffffff' })}>🖼</button>
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
              <h4>Colors</h4>
              <div className="tile-grid cols-6">
                {SWATCHES.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => setBg({ type: 'color', color: c })} title={c} />)}
              </div>
              <ColorRow label="Custom color" value={page.background?.type === 'color' ? page.background.color : '#ffffff'} onChange={(c) => setBg({ type: 'color', color: c })} />
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
                  <button className="btn btn-sm" onClick={() => setBg({ type: 'color', color: '#ffffff' })}>Remove photo</button>
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
                  <span>{e.type === 'text' ? 'T' : e.type === 'image' ? '🖼' : e.type === 'line' ? '—' : '◆'}</span>
                  <span className="name" style={{ opacity: e.hidden ? 0.4 : 1 }}>{e.type === 'text' ? e.text.slice(0, 40) : e.type === 'shape' ? e.shape : e.type}</span>
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
            onPointerDown={(e) => { if (e.target === scrollRef.current) { setSelId(null); setEditingId(null); } }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setAutoFit(false); setZoom((z) => Math.max(0.05, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1)))); } }}
          >
            <div className="ed-canvas-wrap" ref={wrapRef} style={{ width: W * zoom, height: H * zoom, background: page.background?.type === 'none' ? 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 20px 20px' : undefined }}
              onPointerDown={onCanvasDown} onDoubleClick={onCanvasDouble}>
              <DesignPage id="export-svg" design={design} page={renderPage} width={W * zoom} height={H * zoom} uidPrefix="ed-" style={{ cursor: 'default' }} />
              {guides.map((g, i) => (
                <div key={i} className="guide" style={g.v ? { left: g.at * zoom, top: 0, width: 1, height: H * zoom } : { top: g.at * zoom, left: 0, height: 1, width: W * zoom }} />
              ))}
              {sel && !editingId ? (
                <div className={`sel-box ${sel.locked ? 'locked' : ''}`} style={{ left: sel.x * zoom, top: sel.y * zoom, width: sel.w * zoom, height: sel.h * zoom, transform: `rotate(${sel.rotation || 0}deg)` }}>
                  {handles.map((h) => (
                    <div key={h} className={`handle ${h}`} style={{ left: `${hpos[h][0]}%`, top: `${hpos[h][1]}%`, cursor: cursor[h] }} onPointerDown={(e) => onHandleDown(e, h)} />
                  ))}
                  {!sel.locked ? <div className="handle rot" style={{ left: '50%', top: -30 }} onPointerDown={(e) => onHandleDown(e, 'rot')} title="Rotate">⟳</div> : null}
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
          <div className="ed-pages">
            {design.pages.map((p, i) => (
              <div key={p.id} className={`ed-page-thumb ${i === pi ? 'active' : ''}`} onClick={() => { setPageIdx(i); setSelId(null); setEditingId(null); }}>
                <DesignPage design={design} page={p} width={undefined} height="100%" uidPrefix={`pg${i}-`} />
                <span className="n">{i + 1}</span>
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
          {sel ? (
            <Props
              el={sel} update={updateSel} k={k}
              onFont={(e) => loadFont(e)}
              actions={{ deleteSel, duplicateSel, reorder, alignSel, replace: () => replaceRef.current?.click(), setBg: () => { setBg({ type: 'image', src: sel.src, color: '#ffffff', filters: sel.filters }); deleteSel(); } }}
            />
          ) : (
            <>
              <h4>Page {pi + 1} of {design.pages.length}</h4>
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
      {modal === 'present' ? <Presenter design={design} start={pi} onClose={() => setModal(null)} /> : null}
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

function ResizeMenu({ W, H, onApply, onClose }) {
  const [w, setW] = useState(W);
  const [h, setH] = useState(H);
  const [scale, setScale] = useState(true);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>Resize design</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="row">
            <label className="field grow">Width (px)<input className="input" type="number" value={w} onChange={(e) => setW(Number(e.target.value))} /></label>
            <button className="btn btn-sm" style={{ marginTop: 20 }} title="Swap" onClick={() => { setW(h); setH(w); }}>⇄</button>
            <label className="field grow">Height (px)<input className="input" type="number" value={h} onChange={(e) => setH(Number(e.target.value))} /></label>
          </div>
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
          <div className="row"><div className="grow" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => onApply(w, h, scale)}>Resize</button></div>
        </div>
      </div>
    </div>
  );
}

function Props({ el, update, actions, onFont, k }) {
  const f = el.filters || {};
  const sh = el.shadow || {};
  return (
    <>
      {el.type === 'text' ? (
        <>
          <h4>Text</h4>
          <textarea className="input" rows={3} value={el.text} onChange={(e) => update({ text: e.target.value })} />
          <div className="prop" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 2' }}>Font
              <select value={el.fontFamily} onChange={(e) => { update({ fontFamily: e.target.value }); onFont({ ...el, fontFamily: e.target.value }); }} style={{ fontFamily: el.fontFamily }}>
                {[...new Set([...FONTS, el.fontFamily])].map((fnt) => <option key={fnt} value={fnt} style={{ fontFamily: fnt }}>{fnt}</option>)}
              </select>
            </label>
            <Num label="Size" value={el.fontSize} min={1} onChange={(v) => update({ fontSize: Math.max(1, v) })} />
            <Num label="Line height" value={el.lineHeight} step={0.05} onChange={(v) => update({ lineHeight: Math.max(0.5, v) })} />
            <Num label="Letter spacing" value={el.letterSpacing || 0} onChange={(v) => update({ letterSpacing: v })} />
            <label>Color<input type="color" value={/^#[0-9a-f]{6}$/i.test(el.color) ? el.color : '#000000'} onChange={(e) => update({ color: e.target.value })} style={{ height: 31, padding: 2 }} /></label>
          </div>
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
          {el.strokeWidth ? <><ColorRow label="Outline color" value={el.stroke} onChange={(c) => update({ stroke: c })} /><Range label="Outline" min={0.5} max={Math.max(10, el.fontSize / 5)} step={0.5} value={el.strokeWidth} onChange={(v) => update({ strokeWidth: v })} /></> : null}
          {el.bgColor ? <ColorRow label="Highlight color" value={el.bgColor} onChange={(c) => update({ bgColor: c })} /> : null}
        </>
      ) : null}

      {el.type === 'shape' ? (
        <>
          <h4>Shape</h4>
          <ColorRow label="Fill" value={el.fill} onChange={(c) => update({ fill: c })} />
          <div className="toggle-row">
            <button className={`btn ${!el.fill ? 'active' : ''}`} onClick={() => update({ fill: el.fill ? '' : '#7c3aed' })}>No fill</button>
            <button className={`btn ${el.gradient ? 'active' : ''}`} onClick={() => update({ gradient: el.gradient ? '' : '#06b6d4', fill: el.fill || '#7c3aed' })}>Gradient</button>
          </div>
          {el.gradient ? <ColorRow label="Gradient to" value={el.gradient} onChange={(c) => update({ gradient: c })} /> : null}
          <ColorRow label="Border" value={el.stroke} onChange={(c) => update({ stroke: c })} />
          <Range label="Border width" min={0} max={Math.max(40, 60 * k)} value={el.strokeWidth || 0} onChange={(v) => update({ strokeWidth: v })} />
          {el.shape === 'rect' ? <Range label="Corners" min={0} max={Math.min(el.w, el.h) / 2} value={el.radius || 0} onChange={(v) => update({ radius: v })} /> : null}
          {el.shape === 'star' ? <Range label="Points" min={3} max={12} value={el.points || 5} onChange={(v) => update({ points: v })} /> : null}
        </>
      ) : null}

      {el.type === 'line' ? (
        <>
          <h4>Line</h4>
          <ColorRow label="Color" value={el.stroke} onChange={(c) => update({ stroke: c })} />
          <Range label="Thickness" min={1} max={Math.max(40, 60 * k)} value={el.strokeWidth} onChange={(v) => update({ strokeWidth: v, h: Math.max(el.h, v * 2.2) })} />
          <div className="toggle-row">
            <button className={`btn ${el.dash ? 'active' : ''}`} onClick={() => update({ dash: !el.dash })}>Dashed</button>
            <button className={`btn ${el.arrow ? 'active' : ''}`} onClick={() => update({ arrow: !el.arrow, h: Math.max(el.h, el.strokeWidth * 4.4) })}>Arrow</button>
          </div>
        </>
      ) : null}

      {el.type === 'image' ? (
        <>
          <h4>Photo</h4>
          <div className="toggle-row">
            <button className="btn" onClick={actions.replace}>Replace</button>
            <button className="btn" onClick={actions.setBg}>Set as background</button>
            <button className={`btn ${el.flipX ? 'active' : ''}`} onClick={() => update({ flipX: !el.flipX })}>⇋ Flip</button>
            <button className={`btn ${el.flipY ? 'active' : ''}`} onClick={() => update({ flipY: !el.flipY })}>⇵ Flip</button>
            <button className={`btn ${el.fit === 'contain' ? 'active' : ''}`} onClick={() => update({ fit: el.fit === 'contain' ? 'cover' : 'contain' })}>Fit whole</button>
          </div>
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
          <Range label="Corners" min={0} max={Math.min(el.w, el.h) / 2} value={el.radius || 0} onChange={(v) => update({ radius: v })} />
          <ColorRow label="Border" value={el.stroke || '#000000'} onChange={(c) => update({ stroke: c })} />
          <Range label="Border width" min={0} max={40} value={el.strokeWidth || 0} onChange={(v) => update({ strokeWidth: v })} />
        </>
      ) : null}

      <h4>Look</h4>
      <Range label="Opacity" min={0} max={100} value={Math.round((el.opacity ?? 1) * 100)} onChange={(v) => update({ opacity: v / 100 })} suffix="%" />
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
