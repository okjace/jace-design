'use client';
import { useState } from 'react';
import Avatar from './Avatar';

// Shown when someone has the link but needs the owner's OK first.
export default function RequestAccess({ id, status: initial, signedIn, who, owner }) {
  const [status, setStatus] = useState(initial);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function ask(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch(`/api/designs/${id}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Could not send the request');
    if (d.already) location.reload();
    else setStatus('pending');
  }
  return (
    <main className="page page-narrow" style={{ maxWidth: 500 }}>
      <div className="card stack" style={{ marginTop: 40, gap: 14 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h1 style={{ fontSize: 26, margin: 0 }}>You need access</h1>
        <div className="row"><Avatar user={owner} size={32} /><span className="muted">Owned by <b>{owner.name || owner.username}</b></span></div>
        {status === 'pending' ? (
          <div className="notice ok" style={{ margin: 0 }}>Request sent{who ? ` as ${who}` : ''}. You&apos;ll be able to open it once the owner says yes{signedIn ? ' — we’ll email you' : ' — come back to this link later'}.</div>
        ) : status === 'denied' ? (
          <div className="notice err" style={{ margin: 0 }}>The owner said no to your last request.</div>
        ) : null}
        {status !== 'pending' ? (
          <form className="stack" onSubmit={ask}>
            <textarea className="input" rows={3} maxLength={500} placeholder="Add a message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
            {err ? <div className="notice err" style={{ margin: 0 }}>{err}</div> : null}
            <button className="btn btn-primary" disabled={busy}>{status === 'denied' ? 'Ask again' : 'Request access'}</button>
            {who ? <div className="small muted">Asking as {who}.</div> : null}
          </form>
        ) : null}
        {!signedIn ? <a className="small" style={{ color: 'var(--brand)' }} href={`/api/auth/login?next=/d/${id}`}>Have a Jace account? Sign in instead</a> : null}
      </div>
    </main>
  );
}
