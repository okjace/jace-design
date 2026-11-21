'use client';
import { useState } from 'react';

const SUGGESTIONS = ['nature', 'city', 'abstract', 'flowers', 'mountains', 'ocean', 'coffee', 'technology', 'food', 'texture', 'space', 'animals'];

// Free photo & illustration search (Openverse). onPick(result, asBackground)
export default function ImageSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [searched, setSearched] = useState('');

  async function search(term, p = 1, k = kind) {
    if (!term.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/images/search?q=${encodeURIComponent(term)}&page=${p}${k ? `&kind=${k}` : ''}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Search failed');
      setResults((old) => (p === 1 ? d.results : [...old, ...d.results]));
      setPage(p); setMore(d.hasMore); setSearched(term);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

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
      {err ? <p className="small" style={{ color: 'var(--danger)' }}>{err}</p> : null}
      {searched && !results.length && !busy ? <p className="small muted">No results for “{searched}”.</p> : null}
      <div className="photo-grid">
        {results.map((r) => (
          <div key={r.id} className="photo">
            <button className="tile" style={{ padding: 0, width: '100%' }} onClick={() => onPick(r, false)} title={`${r.title}${r.creator ? ` by ${r.creator}` : ''} · ${r.license}`}>
              <img src={`/api/images/${r.id}`} alt={r.title} loading="lazy" />
            </button>
            <button className="btn btn-sm photo-bg" title="Use as background" onClick={() => onPick(r, true)}>🖼</button>
          </div>
        ))}
      </div>
      {busy ? <p className="small muted">Searching…</p> : null}
      {more && !busy ? <button className="btn btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => search(searched, page + 1)}>Load more</button> : null}
      <p className="small muted" style={{ marginTop: 12 }}>Openly licensed images from Openverse. Check each image&apos;s license (shown when you hover) before using it commercially.</p>
    </>
  );
}
