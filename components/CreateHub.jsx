'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESET_GROUPS, blankPage, imageEl, shapeEl, textEl, uid, normalizeDesign } from '@/lib/design';
import { TEMPLATES, templateDesign } from '@/lib/templates';
import { fileToDataUrl } from '@/lib/export';
import DesignPage from './DesignPage';
import { useCreate } from './useCreate';

const TABS = ['All', 'Sizes', 'Templates', 'Import', 'Custom size'];
const UNITS = { px: 1, in: 96, cm: 37.795, mm: 3.7795 };

function PresetShape({ w, h, icon }) {
  const s = 60 / Math.max(w, h);
  return <div className="shape" style={{ width: Math.max(14, w * s), height: Math.max(14, h * s) }}>{w * s > 26 && h * s > 26 ? icon : null}</div>;
}

// Turn a text outline into slides: "# Title" starts a slide, other lines become bullet text.
function outlineToDesign(text, w = 1920, h = 1080) {
  const slides = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s+/.test(line) || (!cur && line.trim())) {
      cur = { title: line.replace(/^#{1,3}\s+/, ''), body: [] };
      slides.push(cur);
    } else if (line.trim()) {
      cur.body.push(line.replace(/^\s*[-*•]\s*/, '• '));
    }
  }
  const palette = [['#1f9d5a', '#0d5c36'], ['#16181d', '#2a2f38'], ['#f093fb', '#f5576c'], ['#43e97b', '#38f9d7']];
  const pages = slides.map((s, i) => {
    const first = i === 0;
    const p = blankPage();
    if (first) {
      p.background = { type: 'gradient', from: palette[0][0], to: palette[0][1], angle: 135 };
      p.elements.push(textEl({ text: s.title, x: w * 0.08, y: h * 0.36, w: w * 0.84, fontFamily: 'Poppins', fontWeight: 700, fontSize: h * 0.11, color: '#ffffff' }));
      if (s.body.length) p.elements.push(textEl({ text: s.body.join('\n').replace(/^• /gm, ''), x: w * 0.08, y: h * 0.56, w: w * 0.84, fontSize: h * 0.045, color: '#ffffff', opacity: 0.9 }));
    } else {
      p.elements.push(textEl({ text: s.title, x: w * 0.08, y: h * 0.1, w: w * 0.84, fontFamily: 'Poppins', fontWeight: 700, fontSize: h * 0.08, color: '#0f172a' }));
      p.elements.push(shapeEl('rect', { x: w * 0.08, y: h * 0.25, w: w * 0.08, h: h * 0.012, fill: '#1f9d5a', radius: 4 }));
      if (s.body.length) p.elements.push(textEl({ text: s.body.join('\n'), x: w * 0.08, y: h * 0.32, w: w * 0.84, fontSize: h * 0.045, color: '#334155', lineHeight: 1.6 }));
    }
    return p;
  });
  return { width: w, height: h, pages: pages.length ? pages : [blankPage()], assets: [] };
}

async function imagesToDesign(files) {
  const imgs = [];
  for (const f of files) imgs.push(await fileToDataUrl(f, 2000));
  const W = imgs[0].width, H = imgs[0].height;
  const pages = imgs.map((img) => {
    const p = blankPage();
    const s = Math.min(W / img.width, H / img.height);
    p.elements.push(imageEl({ src: img.src, w: img.width * s, h: img.height * s, x: (W - img.width * s) / 2, y: (H - img.height * s) / 2 }));
    return p;
  });
  return { width: W, height: H, pages, assets: imgs.map((i) => ({ id: uid(), src: i.src, width: i.width, height: i.height })) };
}

export default function CreateHub() {
  const [tab, setTab] = useState('All');
  const [cat, setCat] = useState('All');
  const { create, createFrom, busy, error } = useCreate();
  const [msg, setMsg] = useState('');
  const [outline, setOutline] = useState('# My presentation\nA subtitle goes here\n\n# First point\n- Something important\n- Another thing\n\n# Thanks!');
  const [link, setLink] = useState('');
  const [custom, setCustom] = useState({ w: 1200, h: 800, unit: 'px', pages: 1 });
  const [drag, setDrag] = useState(false);
  const fileJson = useRef(null);
  const fileImg = useRef(null);
  const show = (t) => tab === 'All' || tab === t;

  async function importFiles(files) {
    setMsg('');
    const list = [...files];
    if (!list.length) return;
    try {
      const json = list.find((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
      if (json) {
        const parsed = JSON.parse(await json.text());
        const design = normalizeDesign(parsed.design || parsed);
        return createFrom(parsed.title || json.name.replace(/(\.jdesign)?\.json$/i, ''), design);
      }
      const text = list.find((f) => /\.(md|txt)$/i.test(f.name));
      if (text) return createFrom(text.name.replace(/\.\w+$/, ''), outlineToDesign(await text.text()));
      const images = list.filter((f) => f.type.startsWith('image/'));
      if (images.length) return createFrom(images[0].name.replace(/\.\w+$/, ''), await imagesToDesign(images));
      setMsg('That file type is not supported yet. Try an image, SVG, .jdesign.json, .md or .txt file.');
    } catch (e) {
      setMsg(`Could not import that file: ${e.message}`);
    }
  }

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('textarea, input')) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); importFiles(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function importLink() {
    const m = link.match(/\/(?:d|design)\/([A-Za-z0-9]+)/) || link.match(/^([A-Za-z0-9]{8,})$/);
    if (!m) return setMsg('Paste a Jace Design link, like https://…/d/abc123');
    const r = await fetch(`/api/designs/${m[1]}/remix`, { method: 'POST' });
    if (!r.ok) return setMsg("Couldn't open that design. It might be private.");
    const { id } = await r.json();
    location.href = `/design/${id}`;
  }

  const cats = ['All', ...new Set(TEMPLATES.map((t) => t.category))];
  // Template previews use random ids, so only render them in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const previews = useMemo(() => (mounted ? Object.fromEntries(TEMPLATES.map((t) => [t.id, templateDesign(t)])) : {}), [mounted]);

  return (
    <main
      className="page"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); importFiles(e.dataTransfer.files); }}
    >
      <h1>Create a design</h1>
      <p className="muted">Pick a size, start from a template, import your own files, or set a custom size. You can also drop or paste files anywhere on this page.</p>
      {error || msg ? <div className="notice err">{error || msg}</div> : null}
      {busy ? <div className="notice ok">Creating your design…</div> : null}
      {drag ? <div className="dropzone">Drop to import ✨</div> : null}
      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {show('Import') ? (
        <section>
          <h2>📥 Import</h2>
          <div className="import-grid">
            <div className="import-card" onClick={() => fileImg.current?.click()}>
              <div className="ico">🖼️</div>
              <div><b>Images & SVGs</b><div className="muted small">PNG, JPG, WebP, GIF or SVG. Pick several to make one page each.</div></div>
            </div>
            <div className="import-card" onClick={() => fileJson.current?.click()}>
              <div className="ico">🗂️</div>
              <div><b>Jace Design file</b><div className="muted small">Open a .jdesign.json you downloaded — or a .md / .txt outline.</div></div>
            </div>
            <div className="import-card" style={{ cursor: 'default' }}>
              <div className="ico">🔗</div>
              <div className="grow stack">
                <b>From a link</b>
                <div className="muted small">Make your own copy of any public or shared Jace Design.</div>
                <div className="row"><input className="input" placeholder="https://…/d/abc123" value={link} onChange={(e) => setLink(e.target.value)} /><button className="btn btn-sm" onClick={importLink}>Go</button></div>
              </div>
            </div>
            <div className="import-card" style={{ cursor: 'default' }}>
              <div className="ico">📋</div>
              <div><b>Paste from clipboard</b><div className="muted small">Copy an image or screenshot, then press Ctrl/⌘ + V on this page.</div></div>
            </div>
          </div>
          <input ref={fileImg} type="file" accept="image/*" multiple hidden onChange={(e) => importFiles(e.target.files)} />
          <input ref={fileJson} type="file" accept=".json,.md,.txt,application/json,text/plain,text/markdown" hidden onChange={(e) => importFiles(e.target.files)} />
          <div className="card" style={{ marginTop: 14 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div style={{ fontSize: 28 }}>📝</div>
              <div className="grow stack">
                <b>Outline → presentation</b>
                <div className="muted small">Write or paste an outline. Each “# Heading” becomes a slide and the lines under it become its points.</div>
                <textarea className="input" rows={7} value={outline} onChange={(e) => setOutline(e.target.value)} style={{ fontFamily: 'Fira Code, monospace', fontSize: 13 }} />
                <div><button className="btn btn-primary" disabled={busy} onClick={() => createFrom(outline.match(/^#?\s*(.+)$/m)?.[1]?.slice(0, 80) || 'Presentation', outlineToDesign(outline))}>Make slides</button></div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {show('Sizes') ? (
        <section>
          {PRESET_GROUPS.map((g) => (
            <div key={g.name}>
              <h2>{g.name}</h2>
              <div className="preset-grid">
                {g.items.map((p) => (
                  <button key={p.name} className="preset" disabled={busy} onClick={() => create({ title: p.name, w: p.w, h: p.h, pages: p.pages })}>
                    <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><PresetShape {...p} /></div>
                    <b>{p.name}</b>
                    <small>{p.w} × {p.h}{p.pages ? ` · ${p.pages} pages` : ''}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {show('Templates') ? (
        <section>
          <h2>🧩 Templates</h2>
          <div className="tabs" style={{ marginTop: 0 }}>
            {cats.map((c) => <button key={c} className={`tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          <div className="grid">
            {mounted && TEMPLATES.filter((t) => cat === 'All' || t.category === cat).map((t) => {
              const d = previews[t.id];
              return (
                <button key={t.id} className="dcard" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} disabled={busy} onClick={() => createFrom(t.name, templateDesign(t))}>
                  <div className="thumb"><DesignPage design={d} page={d.pages[0]} width={undefined} height="100%" uidPrefix={`tpl${t.id}-`} /></div>
                  <span className="dcard-title">{t.name}</span>
                  <span className="dcard-meta">{t.category} · {d.pages.length > 1 ? `${d.pages.length} pages` : `${t.width} × ${t.height}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {show('Custom size') ? (
        <section>
          <h2>📐 Custom size</h2>
          <div className="card row wrap" style={{ alignItems: 'flex-end' }}>
            <label className="field">Width<input className="input" type="number" min="1" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value })} style={{ width: 120 }} /></label>
            <span style={{ paddingBottom: 10 }}>×</span>
            <label className="field">Height<input className="input" type="number" min="1" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value })} style={{ width: 120 }} /></label>
            <label className="field">Units
              <select className="input" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} style={{ width: 100 }}>
                {Object.keys(UNITS).map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="field">Pages<input className="input" type="number" min="1" max="50" value={custom.pages} onChange={(e) => setCustom({ ...custom, pages: e.target.value })} style={{ width: 90 }} /></label>
            <button className="btn btn-primary" disabled={busy} onClick={() => {
              const w = Math.round(Number(custom.w) * UNITS[custom.unit]);
              const h = Math.round(Number(custom.h) * UNITS[custom.unit]);
              if (!(w >= 16 && h >= 16 && w <= 8000 && h <= 8000)) return setMsg('Size must be between 16 and 8000 pixels on each side.');
              create({ title: `${custom.w} × ${custom.h} ${custom.unit}`, w, h, pages: Math.min(50, Math.max(1, Number(custom.pages) || 1)) });
            }}>Create</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
