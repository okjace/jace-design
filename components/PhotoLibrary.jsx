'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { uploadPhoto } from '@/lib/photos';

/**
 * Jace Photos: community photos people uploaded, plus your own.
 *  scope: 'community' | 'mine' | 'user' (with username)
 *  onPick(photo, asBackground): when set, clicking a photo picks it (editor); otherwise it opens it.
 *  manage: show upload / edit / delete controls (your Photos tab).
 */
export default function PhotoLibrary({ scope: initialScope = 'community', username, onPick, manage = false, compact = false, signedIn = true }) {
  const [scope, setScope] = useState(initialScope);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [list, setList] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');
  const [upload, setUpload] = useState(null); // { done, total, failed: [] }
  const [isPublic, setIsPublic] = useState(true);
  const [open, setOpen] = useState(null);
  const fileRef = useRef(null);
  const seq = useRef(0);

  async function load(p = 1, s = scope, t = term) {
    const n = ++seq.current;
    setErr('');
    if (p === 1) setList(null);
    try {
      const r = await fetch(`/api/photos?scope=${s}${username ? `&username=${encodeURIComponent(username)}` : ''}&q=${encodeURIComponent(t)}&page=${p}`, { cache: 'no-store' });
      const d = await r.json();
      if (n !== seq.current) return;
      if (!r.ok) throw new Error(d.error || 'Could not load photos.');
      setList((old) => (p === 1 ? d.photos : [...(old || []), ...d.photos]));
      setPage(p); setMore(d.hasMore);
    } catch (e) {
      if (n === seq.current) { setErr(e.message); setList((old) => old || []); }
    }
  }
  useEffect(() => { load(1, scope, term); }, [scope, term]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(files) {
    const list2 = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list2.length) return;
    const st = { done: 0, total: list2.length, failed: [] };
    setUpload({ ...st });
    for (const f of list2) {
      try { await uploadPhoto(f, { isPublic }); } catch (e) { st.failed.push(`${f.name}: ${e.message}`); }
      st.done += 1;
      setUpload({ ...st });
    }
    setTimeout(() => setUpload((u) => (u && !u.failed.length ? null : u)), 1500);
    if (scope !== 'mine' && manage) setScope('mine'); else load(1);
  }

  async function save(p, patch) {
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    await fetch(`/api/photos/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  }
  async function remove(p) {
    if (!confirm(`Delete “${p.title || 'this photo'}”? Designs that already use it keep their copy.`)) return;
    setList((l) => l.filter((x) => x.id !== p.id));
    setOpen(null);
    await fetch(`/api/photos/${p.id}`, { method: 'DELETE' });
  }

  return (
    <div className={`photo-lib ${compact ? 'compact' : ''}`}
      onDragOver={manage ? (e) => e.preventDefault() : undefined}
      onDrop={manage ? (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); } : undefined}>
      {manage ? (
        <div className="photo-upload">
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>⬆️ Upload photos</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f); }} />
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Share new photos with the community
          </label>
          <span className="small muted">or drag photos here</span>
          {upload ? <span className="small">{upload.done < upload.total ? `Uploading ${upload.done + 1} of ${upload.total}…` : `Uploaded ${upload.total - upload.failed.length} of ${upload.total}`}</span> : null}
          {upload?.failed?.length ? <div className="small" style={{ color: 'var(--danger)', width: '100%' }}>{upload.failed.join(' · ')} <button className="btn btn-sm btn-ghost" onClick={() => setUpload(null)}>OK</button></div> : null}
        </div>
      ) : null}

      <div className="row wrap" style={{ gap: 6 }}>
        {!username ? (
          <div className="toggle-row" style={{ margin: 0 }}>
            <button className={`btn ${scope === 'community' ? 'active' : ''}`} onClick={() => setScope('community')}>Community</button>
            {signedIn ? <button className={`btn ${scope === 'mine' ? 'active' : ''}`} onClick={() => setScope('mine')}>Yours</button> : null}
          </div>
        ) : null}
        <form className="row grow" style={{ gap: 6, minWidth: 180 }} onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
          <input className="input" placeholder="Search Jace Photos…" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: 13 }} />
          <button className="btn btn-sm">🔍</button>
        </form>
      </div>

      {err ? <p className="small" style={{ color: 'var(--danger)' }}>{err}</p> : null}
      {!list ? <p className="small muted">Loading…</p> : !list.length ? (
        <p className="small muted">
          {term ? `No photos match “${term}”.` : scope === 'mine' ? (manage ? 'No photos yet. Upload some above.' : <>No photos yet. Add them in <Link href="/photos?tab=mine" style={{ textDecoration: 'underline' }}>your Photos tab</Link>.</>) : 'No community photos yet. Be the first to share one!'}
        </p>
      ) : (
        <div className="photo-grid jace">
          {list.map((p) => (
            <div key={p.id} className="photo">
              <button className="tile" style={{ padding: 0, width: '100%' }}
                title={`${p.title || 'Photo'} · @${p.username}${p.public ? '' : ' · only you'}`}
                onClick={() => (onPick ? onPick(p, false) : setOpen(p))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.title} loading="lazy" decoding="async" style={p.width && p.height ? { aspectRatio: `${p.width} / ${p.height}` } : undefined} />
                {!p.public ? <span className="photo-private">🔒</span> : null}
              </button>
              {onPick ? <button className="btn btn-sm photo-bg" title="Use as background" onClick={() => onPick(p, true)}>🖼</button> : null}
            </div>
          ))}
        </div>
      )}
      {more ? <button className="btn btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => load(page + 1)}>Load more</button> : null}

      {open ? (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="modal" style={{ width: 'min(820px, 100%)' }}>
            <div className="modal-head"><h3>{open.title || 'Photo'}</h3><button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>✕</button></div>
            <div className="modal-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${open.id}`} alt={open.title} style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: 'var(--canvas-bg)', borderRadius: 10 }} />
              <div className="small muted">By <Link href={`/u/${encodeURIComponent(open.username)}?tab=photos`} style={{ textDecoration: 'underline' }}>@{open.username}</Link> · {open.width} × {open.height}{open.uses ? ` · used ${open.uses} time${open.uses === 1 ? '' : 's'}` : ''}</div>
              {manage && scope === 'mine' ? (
                <div className="stack" style={{ gap: 8 }}>
                  <label className="field small">Title<input className="input" defaultValue={open.title} onBlur={(e) => save(open, { title: e.target.value })} /></label>
                  <label className="field small">Tags (help people find it)<input className="input" defaultValue={open.tags} placeholder="e.g. beach, sunset, summer" onBlur={(e) => save(open, { tags: e.target.value })} /></label>
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" defaultChecked={open.public} onChange={(e) => { save(open, { public: e.target.checked }); setOpen({ ...open, public: e.target.checked }); }} />
                    Shared with the community (anyone can find and use it)
                  </label>
                  <div className="row"><div className="grow" /><button className="btn btn-danger" onClick={() => remove(open)}>🗑 Delete photo</button></div>
                </div>
              ) : open.tags ? <div className="small muted">Tags: {open.tags}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
