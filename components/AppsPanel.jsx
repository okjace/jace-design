'use client';
import { useEffect, useRef, useState } from 'react';
import { BUILTIN_APPS } from './BuiltinApps';
import { aiToPages, extraFonts } from '@/lib/ai';
import { fileToDataUrl } from '@/lib/export';

/**
 * Runs an app someone made. It lives on their own website and is shown here in a locked-down frame
 * (no access to your account or cookies). It can only send things to add to the design.
 * The protocol is described on /apps/developers.
 */
function AppFrame({ app, api, onClose }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState('');
  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    const hello = () => {
      const a = apiRef.current;
      ref.current?.contentWindow?.postMessage({
        jaceDesign: 'hello', version: 1,
        design: { width: a.W, height: a.H, kind: a.kind || 'design' },
        selection: a.sel ? { type: a.sel.type, text: a.sel.type === 'text' ? a.sel.text : undefined } : null,
      }, '*');
    };
    const onMsg = async (e) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return; // only from this app's frame
      const d = e.data;
      if (!d || typeof d !== 'object' || typeof d.jaceDesign !== 'string') return;
      const a = apiRef.current;
      try {
        if (d.jaceDesign === 'ready') { hello(); return; }
        if (d.jaceDesign === 'close') { onClose(); return; }
        if (d.jaceDesign !== 'insert') return;
        if (d.text && typeof d.text === 'object') {
          const [el] = aiToPages({ pages: [{ elements: [{ type: 'text', x: 0, y: 0, w: a.W * 0.7, h: 80, fontSize: 44 * a.k, ...d.text }] }] }, a.W, a.H)[0].elements;
          if (el) a.addEl(el);
        } else if (d.image && typeof d.image === 'object') {
          let src = String(d.image.src || '');
          if (/^https:\/\//.test(src)) {
            setMsg('Getting the image…');
            const blob = await (await fetch(src)).blob();
            src = (await fileToDataUrl(blob, 2000)).src;
          }
          if (!/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(src) || src.length > 8_000_000) throw new Error('The app sent an image this editor can’t use.');
          const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be opened.')); i.src = src; });
          const s = Math.min((a.W * 0.6) / (img.width || 400), (a.H * 0.6) / (img.height || 400));
          a.addImage(src, (img.width || 400) * s, (img.height || 400) * s);
        } else if (Array.isArray(d.elements)) {
          const pages = aiToPages({ width: d.width || a.W, height: d.height || a.H, pages: [{ elements: d.elements.slice(0, 80) }] }, a.W, a.H);
          a.addElements(pages[0].elements, extraFonts(pages));
        }
        setMsg('Added to your design ✓');
        setTimeout(() => setMsg(''), 1800);
      } catch (err) {
        setMsg(err.message || 'Something went wrong adding that.');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [app.url, onClose]);

  return (
    <>
      <iframe
        ref={ref}
        src={app.url}
        title={app.name}
        className="app-frame"
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        allow="clipboard-write"
        referrerPolicy="no-referrer"
        onLoad={() => setTimeout(() => {
          const a = apiRef.current;
          ref.current?.contentWindow?.postMessage({ jaceDesign: 'hello', version: 1, design: { width: a.W, height: a.H, kind: a.kind || 'design' }, selection: null }, '*');
        }, 100)}
      />
      <div className="row small muted" style={{ gap: 8 }}>
        <span className="grow">Made by @{app.username}. Runs on {(() => { try { return new URL(app.url).host; } catch { return 'its own site'; } })()} and can only add things to your design.</span>
        {msg ? <b style={{ color: 'var(--brand)' }}>{msg}</b> : null}
      </div>
    </>
  );
}

/** The Apps tab in the editor: built-in apps, apps you added, and links to find or make more. */
export default function AppsPanel({ api }) {
  const [open, setOpen] = useState(null); // { builtin } | { app }
  const [mine, setMine] = useState(null);
  useEffect(() => {
    fetch('/api/apps?scope=installed', { cache: 'no-store' }).then((r) => r.json()).then((d) => setMine(d.apps || [])).catch(() => setMine([]));
  }, []);

  const openBuiltin = (b) => (b.run ? b.run(api) : setOpen({ builtin: b }));
  const Comp = open?.builtin?.App;

  return (
    <>
      <h4>Apps</h4>
      <div className="app-list">
        {BUILTIN_APPS.map((b) => (
          <button key={b.id} className="app-item" onClick={() => openBuiltin(b)}>
            <span className="app-icon">{b.icon}</span>
            <span className="grow"><b>{b.name}</b><span className="small muted">{b.desc}</span></span>
          </button>
        ))}
      </div>
      <h4>Your apps</h4>
      {!mine ? <p className="small muted">Loading…</p> : !mine.length ? <p className="small muted">None added yet.</p> : (
        <div className="app-list">
          {mine.map((a) => (
            <button key={a.id} className="app-item" onClick={() => setOpen({ app: a })}>
              <span className="app-icon">{a.icon || '🧩'}</span>
              <span className="grow"><b>{a.name}</b><span className="small muted">{a.description || `by @${a.username}`}</span></span>
            </button>
          ))}
        </div>
      )}
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <a className="btn btn-sm" href="/apps" target="_blank" rel="noreferrer">🧭 Find more apps</a>
        <a className="btn btn-sm" href="/apps/new" target="_blank" rel="noreferrer">＋ Make your own</a>
      </div>
      <p className="small muted">Added an app in another tab? <button className="btn btn-sm btn-ghost" onClick={() => { setMine(null); fetch('/api/apps?scope=installed', { cache: 'no-store' }).then((r) => r.json()).then((d) => setMine(d.apps || [])).catch(() => setMine([])); }}>Refresh</button></p>

      {open ? (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="modal" style={{ width: open.app ? 'min(900px, 100%)' : 'min(520px, 100%)' }}>
            <div className="modal-head">
              <h3>{open.builtin ? `${open.builtin.icon} ${open.builtin.name}` : `${open.app.icon || '🧩'} ${open.app.name}`}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>✕</button>
            </div>
            <div className="modal-body">
              {Comp ? <Comp api={api} onClose={() => setOpen(null)} /> : <AppFrame app={open.app} api={api} onClose={() => setOpen(null)} />}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
