'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountTerms } from './TermsNotice';

// Shown to visitors without a Jace account: they give a name before seeing a design.
export default function GuestGate({ title, next }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Something went wrong');
    router.refresh();
  }
  return (
    <main className="page page-narrow" style={{ maxWidth: 460 }}>
      <div className="card stack" style={{ marginTop: 40, gap: 14 }}>
        <div style={{ fontSize: 40 }}>👋</div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Who&apos;s viewing?</h1>
        <p className="muted" style={{ margin: 0 }}>Sign in with Jace, or tell us your name to open {title}. The owner can see who viewed or commented.</p>
        <a className="btn btn-jace" href={`/api/auth/login?next=${encodeURIComponent(next)}`}>Sign in with Jace</a>
        <div className="row small muted"><span className="grow" style={{ borderTop: '1px solid var(--line)' }} />or<span className="grow" style={{ borderTop: '1px solid var(--line)' }} /></div>
        <form onSubmit={go} className="stack">
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoFocus required />
          {err ? <div className="notice err" style={{ margin: 0 }}>{err}</div> : null}
          <button className="btn btn-primary" disabled={busy || name.trim().length < 2}>Continue as guest</button>
          <AccountTerms />
        </form>
      </div>
    </main>
  );
}
