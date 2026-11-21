'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DesignPage from './DesignPage';
import Avatar from './Avatar';

export function Thumb({ data, uid, thumb }) {
  if (thumb) {
    return (
      <div className="thumb">
        <img src={thumb} alt="" loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 2px 6px rgba(0,0,0,.14)' }} />
      </div>
    );
  }
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
  if (data?.kind === 'sheet') {
    const s = data.sheets?.[0] || { cells: {} };
    return (
      <div className="thumb">
        <table className="sheet-thumb">
          <tbody>
            {Array.from({ length: 12 }, (_, r) => (
              <tr key={r}>{'ABCDEF'.split('').map((c) => {
                const cell = s.cells?.[`${c}${r + 1}`];
                const v = cell?.v ?? '';
                return <td key={c} style={{ fontWeight: cell?.b ? 700 : 400, background: cell?.bg }}>{String(v).startsWith('=') ? 'ƒ' : String(v).slice(0, 10)}</td>;
              })}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (data?.kind === 'doc') {
    const s = 190 / (data.width || 816);
    return (
      <div className="thumb">
        <div className="doc-thumb">
          <div className="doc-thumb-inner" style={{ transform: `scale(${s})` }}>
            <div className="doc-paper doc-content" style={{ width: data.width, height: data.height, padding: (data.page?.margin ?? 1) * 96, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: data.html || '' }} />
          </div>
        </div>
      </div>
    );
  }
  const page = data?.pages?.[0];
  if (!page) return <div className="thumb" />;
  return (
    <div className="thumb">
      <DesignPage design={data} page={page} width="100%" height="100%" uidPrefix={`t${uid}-`} />
    </div>
  );
}

const VIS = { private: 'Private', link: 'Anyone with link', public: 'Public' };

export default function DesignCard({ d, mine, author, href, folders }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [starred, setStarred] = useState(!!d.starred);
  const [pickFolder, setPickFolder] = useState(false);
  async function star() {
    const on = !starred;
    setStarred(on);
    const r = await fetch(`/api/designs/${d.id}/star`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) });
    if (!r.ok) setStarred(!on); else router.refresh();
  }
  async function moveTo(folderId) {
    setPickFolder(false);
    setBusy(true);
    await fetch(`/api/designs/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId || null }) });
    setBusy(false);
    router.refresh();
  }
  const target = href || (mine ? `/design/${d.id}` : `/d/${d.id}`);

  async function act(kind) {
    setBusy(true);
    try {
      if (kind === 'rename') {
        const title = prompt('Rename design', d.title);
        if (title) await fetch(`/api/designs/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      } else if (kind === 'copy') {
        const r = await fetch(`/api/designs/${d.id}/remix`, { method: 'POST' });
        if (r.ok) { const { id } = await r.json(); router.push(`/design/${id}`); return; }
      } else if (kind === 'delete') {
        if (!confirm(`Delete "${d.title}"? This can't be undone.`)) return;
        await fetch(`/api/designs/${d.id}`, { method: 'DELETE' });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dcard" style={busy ? { opacity: 0.5 } : undefined}>
      <Link href={target}><Thumb data={d.data} uid={d.id} thumb={d.thumb} /></Link>
      {d.starred !== undefined ? (
        <button className={`dcard-star ${starred ? 'on' : ''}`} title={starred ? 'Unstar' : 'Star'} onClick={star}>{starred ? '★' : '☆'}</button>
      ) : null}
      {mine ? (
        <div className="dcard-menu row">
          <button className="btn btn-sm" title="Rename" onClick={() => act('rename')}>✏️</button>
          <button className="btn btn-sm" title="Make a copy" onClick={() => act('copy')}>⧉</button>
          {folders ? <button className="btn btn-sm" title="Move to a folder" onClick={() => setPickFolder(!pickFolder)}>📁</button> : null}
          <Link className="btn btn-sm" title="View page" href={`/d/${d.id}`}>👁</Link>
          <button className="btn btn-sm" title="Delete" onClick={() => act('delete')}>🗑</button>
        </div>
      ) : null}
      {pickFolder ? (
        <div className="dcard-folders">
          <button className={!d.folder_id ? 'active' : ''} onClick={() => moveTo(null)}>No folder</button>
          {folders.map((f) => <button key={f.id} className={d.folder_id === f.id ? 'active' : ''} onClick={() => moveTo(f.id)}>📁 {f.name}</button>)}
          {!folders.length ? <span className="small muted">Make a folder first (＋ New folder above).</span> : null}
        </div>
      ) : null}
      <Link href={target} className="dcard-title">{d.title}</Link>
      <div className="dcard-meta">
        {author ? (
          <Link href={`/u/${encodeURIComponent(author.username)}`} className="row" style={{ gap: 6 }}>
            <Avatar user={author} size={20} /> {author.name || author.username}
          </Link>
        ) : (
          <>
            <span>{d.width} × {d.height}</span>
            {mine && d.visibility ? <span className={`badge ${d.visibility}`}>{VIS[d.visibility]}</span> : null}
          </>
        )}
        {d.likes != null ? <span style={{ marginLeft: 'auto' }}>♥ {d.likes}</span> : null}
      </div>
    </div>
  );
}
