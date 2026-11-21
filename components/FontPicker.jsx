'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_LIBRARY_FONTS, FONT_CATEGORIES, categoryOf, previewHref } from '@/lib/fontLibrary';

// ---- previews: each font's own name drawn in that font, loaded under a separate name so it never
// clashes with the full font, and only when it scrolls into view ----
const previewState = new Map(); // family -> 'loading' | 'ok' | 'fail'
const pname = (f) => `jdp ${f}`;

async function loadPreview(family) {
  if (previewState.has(family)) return previewState.get(family);
  previewState.set(family, 'loading');
  try {
    const css = await (await fetch(previewHref(family))).text();
    const url = css.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) throw new Error('no font');
    const face = new FontFace(pname(family), `url(${url})`);
    await face.load();
    document.fonts.add(face);
    previewState.set(family, 'ok');
  } catch {
    previewState.set(family, 'fail');
  }
  return previewState.get(family);
}

const RECENT_KEY = 'jd-recent-fonts';
function readRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function pushRecent(f) { try { localStorage.setItem(RECENT_KEY, JSON.stringify([f, ...readRecent().filter((x) => x !== f)].slice(0, 8))); } catch {} }

function FontRow({ family, active, isLocal, onPick }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(isLocal || previewState.get(family) === 'ok');
  useEffect(() => {
    if (ready || isLocal) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        loadPreview(family).then((s) => s === 'ok' && setReady(true));
      }
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [family, ready, isLocal]);
  return (
    <button ref={ref} type="button" className={`font-row ${active ? 'on' : ''}`} onClick={() => onPick(family)} title={family}>
      <span style={{ fontFamily: isLocal ? `"${family}"` : ready ? `"${pname(family)}"` : 'inherit', opacity: ready || isLocal ? 1 : 0.55 }}>{family}</span>
      {active ? <span className="font-check">✓</span> : null}
    </button>
  );
}

/**
 * Searchable font list with previews.
 * value: current font · designFonts: fonts already in this design (uploaded + added)
 * onPick(family) · onUpload(file) · onAddGoogle(name)
 */
export default function FontPicker({ value, designFonts = [], uploaded = [], onPick, onUpload, onAddGoogle, height = 260 }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [recent, setRecent] = useState([]);
  const fileRef = useRef(null);
  useEffect(() => setRecent(readRecent()), []);

  const term = q.trim().toLowerCase();
  const list = useMemo(() => {
    let fonts = cat === 'all' ? ALL_LIBRARY_FONTS : cat === 'mine' ? designFonts : FONT_CATEGORIES.find((c) => c.id === cat)?.fonts || [];
    if (term) fonts = [...new Set([...designFonts, ...ALL_LIBRARY_FONTS])].filter((f) => f.toLowerCase().includes(term));
    return fonts;
  }, [cat, term, designFonts]);
  const exact = term && !list.some((f) => f.toLowerCase() === term);

  const pick = (f) => { pushRecent(f); setRecent(readRecent()); onPick(f); };

  return (
    <div className="font-picker" onKeyDown={(e) => e.stopPropagation()}>
      <input className="input" placeholder="🔍 Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '7px 10px', fontSize: 13 }} />
      <div className="font-cats">
        {[['all', 'All'], ['mine', 'This design'], ...FONT_CATEGORIES.map((c) => [c.id, c.name])].map(([id, name]) => (
          <button key={id} type="button" className={cat === id && !term ? 'on' : ''} onClick={() => { setCat(id); setQ(''); }}>{name}</button>
        ))}
      </div>
      {!term && cat === 'all' && recent.length ? (
        <>
          <div className="font-head">Recently used</div>
          {recent.map((f) => <FontRow key={`r-${f}`} family={f} active={f === value} isLocal={uploaded.includes(f)} onPick={pick} />)}
          <div className="font-head">All fonts · {ALL_LIBRARY_FONTS.length}</div>
        </>
      ) : null}
      <div className="font-list" style={{ maxHeight: height }}>
        {list.map((f) => <FontRow key={f} family={f} active={f === value} isLocal={uploaded.includes(f)} onPick={pick} />)}
        {exact ? (
          <button type="button" className="font-row" onClick={() => onAddGoogle?.(q.trim())}>
            <span>➕ Try “{q.trim()}” from Google Fonts</span>
          </button>
        ) : null}
        {!list.length && !exact ? <div className="small muted" style={{ padding: 8 }}>{cat === 'mine' ? 'No fonts added to this design yet.' : 'No fonts found.'}</div> : null}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn-sm grow" onClick={() => fileRef.current?.click()}>⬆️ Upload your font</button>
        <span className="small muted">{categoryOf(value) && value ? '' : ''}</span>
      </div>
      <input ref={fileRef} type="file" hidden accept=".ttf,.otf,.woff,.woff2,font/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload?.(f); }} />
    </div>
  );
}
