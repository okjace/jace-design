'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Avatar from './Avatar';

export default function Comments({ id, initial, canComment, signedIn }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch(`/api/designs/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Could not post'); return; }
    setBody('');
    router.refresh();
  }
  return (
    <div>
      {initial.length ? initial.map((c) => (
        <div className="comment" key={c.id}>
          {c.username ? (
            <Link href={`/u/${encodeURIComponent(c.username)}`}><Avatar user={c} size={30} /></Link>
          ) : <Avatar user={{ name: c.guest_name || 'Guest' }} size={30} />}
          <div className="grow">
            <div className="small">
              {c.username
                ? <Link href={`/u/${encodeURIComponent(c.username)}`}><b>{c.name || c.username}</b></Link>
                : <><b>{c.guest_name || 'Guest'}</b> <span className="badge">guest</span></>}
              {' '}<span className="muted">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
          </div>
        </div>
      )) : <p className="muted small">No comments yet.</p>}
      {canComment ? (
        <form onSubmit={submit} className="stack" style={{ marginTop: 12 }}>
          <textarea className="input" rows={3} maxLength={1000} placeholder="Say something nice…" value={body} onChange={(e) => setBody(e.target.value)} />
          {err ? <div className="notice err">{err}</div> : null}
          <div><button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>Post comment</button></div>
        </form>
      ) : !signedIn ? <a className="btn btn-sm" style={{ marginTop: 10 }} href={`/api/auth/login?next=/d/${id}`}>Sign in with Jace to comment</a> : null}
    </div>
  );
}
