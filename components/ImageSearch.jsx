'use client';
import { useRef, useState } from 'react';

const SUGGESTIONS = ['nature', 'city', 'abstract', 'flowers', 'mountains', 'ocean', 'coffee', 'technology', 'food', 'texture', 'space', 'animals'];

// Searches are remembered for this visit, so going back to a search is instant.
const memory = new Map();

/** Full-size address for a search result (older results only had an id). */
export const fullImageUrl = (r) => r.full || `/api/images/${r.id}?full=1`;

// Free photo & illustration search (Openverse, with Wikimedia Commons as a backup). onPick(result, asBackground)
export default function ImageSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [searched, setSearched] = useState('');
  const [broken, setBroken] = useState(() => new Set());
  const seq = useRef(0);

  async function search(term, p = 1, k = kind) {
    term = term.trim();
    if (!term) return;
    const key = `${term.toLowerCase()}|${p}|${k}`;
    const mine = ++seq.current;
    setErr('');
    if (p === 1) setSearched(term);
    const apply = (d) => {
      if (mine !== seq.current) return; // a newer search already started
      setResults((old) => (p === 1 ? d.results : [...old, ...d.results.filter((x) => !old.some((o) => o.id === x.id))]));
      setPage(p); setMore(d.hasMore);
    };
    if (memory.has(key)) { apply(memory.get(key)); return; }
    setBusy(true);
    try {
      let d = null;
      for (let i = 0; i < 2 && !d; i++) {
        const r = await fetch(`/api/images/search?q=${encodeURIComponent(term)}&page=${p}${k ? `&kind=${k}` : ''}`);
        if (r.ok) d = await r.json();
        else if (i === 0) await new Promise((res) => setTimeout(res, 700));
      }
      if (!d) throw new Error('The image libraries are busy. Try again in a moment.');
      memory.set(key, d);
      apply(d);
    } catch (e) {
      if (mine === seq.current) setErr(e.message);
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  const shown = results.filter((r) => !broken.has(r.id));

  return (
    <>
      <h4>Photos & illustrations</h4>
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); search(q); }}>
        <input className="input" placeholder="Search free images…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <button className="btn btn-sm" disabled={busy || !q.trim()}>🔍</button>
      </form>
      <div className="toggle-row" style={{ marginTop: 8 }}>
        {[['', 'All'], ['photo', 'Photos'], ['illustration', 'Illustrations']].map(([k, l]) => (
          <button key={k} className={`btn ${kind === k ? 'active' : ''}`} onClick={() => { setKind(k); if (searched) search(searched, 1, k); }}>{l}</button>
        ))}
      </div>
      {!searched ? (
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          {SUGGESTIONS.map((s) => <button key={s} className="btn btn-sm" onClick={() => { setQ(s); search(s); }}>{s}</button>)}
        </div>
      ) : null}
      {err ? (
        <p className="small" style={{ color: 'var(--danger)' }}>{err} <button className="btn btn-sm" onClick={() => search(searched || q)}>Retry</button></p>
      ) : null}
      {searched && !shown.length && !busy && !err ? <p className="small muted">No results for “{searched}”.</p> : null}
      <div className="photo-grid">
        {shown.map((r) => (
          <div key={r.id} className="photo">
            <button className="tile" style={{ padding: 0, width: '100%' }} onClick={() => onPick(r, false)} title={`${r.title}${r.creator ? ` by ${r.creator}` : ''} · ${r.license}`}>
              <img
                src={r.thumb || `/api/images/${r.id}`}
                alt={r.title}
                loading="lazy"
                decoding="async"
                style={r.width && r.height ? { aspectRatio: `${r.width} / ${r.height}` } : undefined}
                onError={() => setBroken((b) => new Set(b).add(r.id))}
              />
            </button>
            <button className="btn btn-sm photo-bg" title="Use as background" onClick={() => onPick(r, true)}>🖼</button>
          </div>
        ))}
      </div>
      {busy ? <p className="small muted">Searching…</p> : null}
      {more && !busy ? <button className="btn btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => search(searched, page + 1)}>Load more</button> : null}
      <p className="small muted" style={{ marginTop: 12 }}>Free, openly licensed images from Openverse and Wikimedia Commons. Check each image&apos;s license (shown when you hover) before using it commercially.</p>
    </>
  );
}
