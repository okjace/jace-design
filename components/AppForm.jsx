'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Make or edit an app: a name, an emoji icon, a short description and the https:// page it lives on. */
export default function AppForm({ editId }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', icon: '🧩', description: '', url: 'https://', public: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    if (!editId) return;
    fetch('/api/apps?scope=mine', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      const a = (d.apps || []).find((x) => x.id === editId);
      if (a) setF({ name: a.name, icon: a.icon, description: a.description, url: a.url, public: a.public });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [editId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch(editId ? `/api/apps/${editId}` : '/api/apps', { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error || 'Could not save the app.'); return; }
    router.push('/apps');
    router.refresh();
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  if (!loaded) return <p className="muted">Loading…</p>;
  return (
    <form className="card stack" style={{ gap: 14 }} onSubmit={submit}>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <label className="field" style={{ width: 80 }}>Icon<input className="input" value={f.icon} onChange={set('icon')} style={{ fontSize: 22, textAlign: 'center' }} /></label>
        <label className="field grow">Name<input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Meme maker" required /></label>
      </div>
      <label className="field">What it does<input className="input" value={f.description} onChange={set('description')} placeholder="One sentence" /></label>
      <label className="field">Address of your app (https://)
        <input className="input" value={f.url} onChange={set('url')} placeholder="https://you.github.io/my-app/" required />
      </label>
      <div className="small muted">Your app is a web page you host anywhere (GitHub Pages, Vercel…). It opens inside the editor and sends things to add to the design. <Link href="/apps/developers" style={{ textDecoration: 'underline' }}>See how</Link>.</div>
      <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={f.public} onChange={set('public')} /> List it in the app directory so others can add it</label>
      {err ? <div className="notice err" style={{ margin: 0 }}>{err}</div> : null}
      <div className="row"><div className="grow" /><Link className="btn" href="/apps">Cancel</Link><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save' : 'Make app'}</button></div>
    </form>
  );
}
