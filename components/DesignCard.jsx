'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import DesignPage from './DesignPage';
import Avatar from './Avatar';

export function Thumb({ data, uid }) {
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
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

export default function DesignCard({ d, mine, author, href }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
      <Link href={target}><Thumb data={d.data} uid={d.id} /></Link>
      {mine ? (
        <div className="dcard-menu row">
          <button className="btn btn-sm" title="Rename" onClick={() => act('rename')}>✏️</button>
          <button className="btn btn-sm" title="Make a copy" onClick={() => act('copy')}>⧉</button>
          <Link className="btn btn-sm" title="View page" href={`/d/${d.id}`}>👁</Link>
          <button className="btn btn-sm" title="Delete" onClick={() => act('delete')}>🗑</button>
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
