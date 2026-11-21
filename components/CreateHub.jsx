'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DOC_SIZES, PRESET_GROUPS, blankDoc, blankPage, imageEl, shapeEl, textEl, uid, normalizeDesign } from '@/lib/design';
import { TEMPLATES, templateDesign } from '@/lib/templates';
import { fileToDataUrl } from '@/lib/export';
import { cleanHtml, markdownToHtml, textToHtml } from '@/lib/htmlClean';
import { aiToDesign, aiToDocHtml, extractJson, fillAiImages } from '@/lib/ai';
import DesignPage from './DesignPage';
import AiHelper from './AiHelper';
import { Thumb } from './DesignCard';
import { useCreate } from './useCreate';

const TABS = ['All', 'AI', 'Docs', 'Sizes', 'Templates', 'Import', 'Custom size'];

const DOC_TEMPLATES = [
  { name: 'Blank document', icon: '📄', html: '<h1>Untitled document</h1><p>Start typing…</p>' },
  { name: 'Letter', icon: '✉️', html: '<p>Your Name<br>Street address<br>City, ZIP</p><p>November 20, 2026</p><p>Dear [Name],</p><p>Write your letter here.</p><p>Sincerely,<br>Your Name</p>' },
  { name: 'Resume', icon: '🧑‍💼', html: '<h1>Your Name</h1><p>you@example.com · (555) 010-0100 · City</p><h2>Experience</h2><h3>Job title — Company (2023–now)</h3><ul><li>What you achieved, with numbers</li><li>Another win</li></ul><h2>Education</h2><p>Degree — School (Year)</p><h2>Skills</h2><p>Skill one · Skill two · Skill three</p>' },
  { name: 'Report', icon: '📊', html: '<h1>Report title</h1><p><em>Prepared by Your Name · Date</em></p><h2>Summary</h2><p>The key points in two or three sentences.</p><h2>Findings</h2><table><thead><tr><th>Item</th><th>Result</th><th>Notes</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Next steps</h2><ol><li>First step</li><li>Second step</li></ol>' },
  { name: 'Essay', icon: '📝', html: '<h1 style="text-align: center">Essay title</h1><p style="text-align: center">Your Name · Class · Date</p><p style="line-height: 2">Introduction paragraph…</p><p style="line-height: 2">Body paragraph…</p><p style="line-height: 2">Conclusion…</p>' },
  { name: 'Meeting notes', icon: '🗒️', html: '<h1>Meeting notes</h1><p><strong>Date:</strong> <br><strong>People:</strong> </p><h2>Agenda</h2><ul><li><br></li></ul><h2>Notes</h2><p><br></p><h2>Action items</h2><ul class="checklist"><li>Task — owner</li></ul>' },
  { name: 'To-do list', icon: '✅', html: '<h1>To do</h1><ul class="checklist"><li>First thing</li><li>Second thing</li><li>Third thing</li></ul>' },
];
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
      const docx = list.find((f) => /\.docx$/i.test(f.name));
      if (docx) {
        const mammoth = await import('mammoth/mammoth.browser');
        const res = await mammoth.convertToHtml({ arrayBuffer: await docx.arrayBuffer() });
        return createFrom(docx.name.replace(/\.docx$/i, ''), blankDoc('letter', cleanHtml(res.value)));
      }
      const page = list.find((f) => /\.html?$/i.test(f.name));
      if (page) return createFrom(page.name.replace(/\.\w+$/, ''), blankDoc('letter', cleanHtml(await page.text())));
      const text = list.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
      if (text) {
        const body = await text.text();
        const html = /\.txt$/i.test(text.name) ? textToHtml(body) : markdownToHtml(body);
        return createFrom(text.name.replace(/\.\w+$/, ''), blankDoc('letter', cleanHtml(html)));
      }
      const images = list.filter((f) => f.type.startsWith('image/'));
      if (images.length) return createFrom(images[0].name.replace(/\.\w+$/, ''), await imagesToDesign(images));
      setMsg('That file type is not supported yet. Try an image, SVG, Word (.docx), .jdesign.json, .html, .md or .txt file.');
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

  // ---- AI ----
  const [ai, setAi] = useState(null); // 'design' | 'doc'
  const [aiSize, setAiSize] = useState('1080x1080');
  const [aiPages, setAiPages] = useState(1);
  const [aiDocSize, setAiDocSize] = useState('letter');
  const [aw, ah] = aiSize.split('x').map(Number);
  async function applyAi(reply, idea, progress) {
    if (ai === 'doc') {
      const html = aiToDocHtml(reply);
      if (!html.trim()) throw new Error('The reply was empty.');
      const firstHeading = html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '');
      await createFrom(firstHeading || idea.slice(0, 60) || 'Document', blankDoc(aiDocSize, html));
      return;
    }
    const { title, design } = aiToDesign(extractJson(reply), aw, ah);
    design.pages = await fillAiImages(design.pages, progress);
    progress?.('Creating your design…');
    await createFrom(title || idea.slice(0, 60) || 'AI design', design);
  }

  // ---- your & community templates ----
  const [tplScope, setTplScope] = useState('builtin');
  const [userTpls, setUserTpls] = useState(null);
  useEffect(() => {
    if (tplScope === 'builtin') return;
    setUserTpls(null);
    fetch(`/api/templates?scope=${tplScope}`).then((r) => r.json()).then((d) => setUserTpls(d.templates || [])).catch(() => setUserTpls([]));
  }, [tplScope]);
  async function openUserTemplate(t) {
    const r = await fetch(`/api/designs/${t.id}/remix`, { method: 'POST' });
    if (r.status === 401) { location.href = '/api/auth/login?next=/new'; return; }
    if (!r.ok) return setMsg("Couldn't use that template.");
    location.href = `/design/${(await r.json()).id}`;
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

      {show('AI') ? (
        <section>
          <h2>✨ Create with AI</h2>
          <div className="import-grid">
            <div className="import-card" onClick={() => setAi('design')}>
              <div className="ico">🎨</div>
              <div><b>Design with AI</b><div className="muted small">Describe a poster, post, slides or card. Any AI designs it, with real photos filled in.</div></div>
            </div>
            <div className="import-card" onClick={() => setAi('doc')}>
              <div className="ico">📝</div>
              <div><b>Write a document with AI</b><div className="muted small">Letters, essays, reports, resumes — written for you, ready to edit.</div></div>
            </div>
          </div>
          <p className="small muted">Works with ChatGPT, Claude, Gemini, Copilot or any AI you like. No account needed here and it&apos;s free.</p>
        </section>
      ) : null}

      {show('Docs') ? (
        <section>
          <h2>📄 Documents</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Word-style documents you type in: headings, lists, tables, images, page breaks, then print or download as Word or PDF.</p>
          <div className="preset-grid">
            {DOC_TEMPLATES.map((t) => (
              <button key={t.name} className="preset" disabled={busy} onClick={() => createFrom(t.name === 'Blank document' ? 'Untitled document' : t.name, blankDoc('letter', t.html))}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><div className="shape" style={{ width: 46, height: 60 }}>{t.icon}</div></div>
                <b>{t.name}</b>
                <small>Letter · editable</small>
              </button>
            ))}
            {Object.entries(DOC_SIZES).filter(([k]) => k !== 'letter').map(([k, s]) => (
              <button key={k} className="preset" disabled={busy} onClick={() => createFrom('Untitled document', blankDoc(k))}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><PresetShape w={s.w} h={s.h} icon="📄" /></div>
                <b>Blank {k.toUpperCase()}</b>
                <small>{s.name}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
              <div><b>Documents & files</b><div className="muted small">Word (.docx), web pages (.html), Markdown, text — or a .jdesign.json you downloaded.</div></div>
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
          <input ref={fileJson} type="file" accept=".json,.docx,.html,.htm,.md,.markdown,.txt" hidden onChange={(e) => importFiles(e.target.files)} />
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
            {[['builtin', 'Jace Design'], ['mine', 'Your templates'], ['community', 'Community']].map(([k, l]) => (
              <button key={k} className={`tab ${tplScope === k ? 'active' : ''}`} onClick={() => setTplScope(k)}>{l}</button>
            ))}
          </div>
          {tplScope !== 'builtin' ? (
            !userTpls ? <p className="muted">Loading…</p> : !userTpls.length ? (
              <div className="card center muted">
                {tplScope === 'mine' ? <>No templates yet. Open any design and press <b>📌 Template</b> to save it as one.</> : 'No community templates yet. Be the first: save a design as a template and choose “Community”.'}
              </div>
            ) : (
              <div className="grid">
                {userTpls.map((t) => (
                  <button key={t.id} className="dcard" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => openUserTemplate(t)}>
                    <Thumb data={t.data} uid={`u${t.id}`} />
                    <span className="dcard-title">{t.title}</span>
                    <span className="dcard-meta">{t.category || (t.data?.kind === 'doc' ? 'Document' : `${t.width} × ${t.height}`)}{tplScope === 'community' ? ` · @${t.username}` : ''}{t.uses ? ` · used ${t.uses}×` : ''}</span>
                  </button>
                ))}
              </div>
            )
          ) : null}
          {tplScope === 'builtin' ? (
          <div className="tabs" style={{ marginTop: 0 }}>
            {cats.map((c) => <button key={c} className={`tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          ) : null}
          <div className="grid">
            {mounted && tplScope === 'builtin' && TEMPLATES.filter((t) => cat === 'All' || t.category === cat).map((t) => {
              const d = previews[t.id];
              return (
                <button key={t.id} className="dcard" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} disabled={busy} onClick={() => createFrom(t.name, templateDesign(t))}>
                  <div className="thumb"><DesignPage design={d} page={d.pages[0]} width="100%" height="100%" uidPrefix={`tpl${t.id}-`} /></div>
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
      {ai ? (
        <AiHelper
          mode={ai}
          context={{ width: aw, height: ah, pages: aiPages }}
          onApply={applyAi}
          onClose={() => setAi(null)}
          extra={ai === 'design' ? (
            <div className="row wrap" style={{ gap: 8 }}>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>Size
                <select className="input" value={aiSize} onChange={(e) => setAiSize(e.target.value)}>
                  {PRESET_GROUPS.flatMap((g) => g.items).map((p) => <option key={p.name} value={`${p.w}x${p.h}`}>{p.name} ({p.w}×{p.h})</option>)}
                </select>
              </label>
              <label className="field">Pages
                <input className="input" type="number" min={1} max={20} value={aiPages} onChange={(e) => setAiPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 80 }} />
              </label>
            </div>
          ) : (
            <label className="field">Page size
              <select className="input" value={aiDocSize} onChange={(e) => setAiDocSize(e.target.value)}>
                {Object.entries(DOC_SIZES).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
              </select>
            </label>
          )}
        />
      ) : null}
    </main>
  );
}
