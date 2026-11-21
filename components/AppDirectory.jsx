'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BUILTIN_APPS } from './BuiltinApps';

/** The app directory: built-in apps, apps people made (add them to your Apps tab), and yours. */
export default function AppDirectory({ signedIn }) {
  const [apps, setApps] = useState(null);
  const [mine, setMine] = useState([]);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');

  const load = () => {
    fetch(`/api/apps?q=${encodeURIComponent(term)}`, { cache: 'no-store' }).then((r) => r.json()).then((d) => setApps(d.apps || [])).catch(() => setApps([]));
    if (signedIn) fetch('/api/apps?scope=mine', { cache: 'no-store' }).then((r) => r.json()).then((d) => setMine(d.apps || [])).catch(() => {});
  };
  useEffect(load, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(a) {
    if (!signedIn) { location.href = '/api/auth/login?next=/apps'; return; }
    setApps((l) => l.map((x) => (x.id === a.id ? { ...x, installed: !a.installed, installs: x.installs + (a.installed ? -1 : 1) } : x)));
    await fetch(`/api/apps/${a.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ installed: !a.installed }) });
  }
  async function remove(a) {
    if (!confirm(`Delete your app “${a.name}”? It disappears for everyone who added it.`)) return;
    await fetch(`/api/apps/${a.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <form className="row grow" style={{ gap: 6, minWidth: 220 }} onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
          <input className="input" placeholder="Search apps…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">🔍</button>
        </form>
        <Link className="btn btn-primary" href="/apps/new">＋ Make an app</Link>
        <Link className="btn" href="/apps/developers">How apps work</Link>
      </div>

      {mine.length ? (
        <section>
          <h2 style={{ fontSize: 20 }}>Your apps</h2>
          <div className="app-cards">
            {mine.map((a) => (
              <div key={a.id} className="card app-card">
                <div className="app-icon big">{a.icon}</div>
                <div className="grow"><b>{a.name}</b><div className="small muted">{a.public ? `In the directory · added ${a.installs} time${a.installs === 1 ? '' : 's'}` : 'Only you can see it'}</div></div>
                <div className="row" style={{ gap: 6 }}>
                  <Link className="btn btn-sm" href={`/apps/new?edit=${a.id}`}>✏️ Edit</Link>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: 20 }}>Made by the community</h2>
        {!apps ? <p className="muted">Loading…</p> : !apps.length ? <p className="muted">{term ? `No apps match “${term}”.` : 'No community apps yet. Make the first one!'}</p> : (
          <div className="app-cards">
            {apps.map((a) => (
              <div key={a.id} className="card app-card">
                <div className="app-icon big">{a.icon}</div>
                <div className="grow">
                  <b>{a.name}</b>
                  <div className="small muted">{a.description}</div>
                  <div className="small muted">by @{a.username} · {a.installs} added</div>
                </div>
                {a.mine ? <span className="small muted">Yours</span> : (
                  <button className={`btn btn-sm ${a.installed ? '' : 'btn-primary'}`} onClick={() => toggle(a)}>{a.installed ? '✓ Added' : '＋ Add'}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 20 }}>Built in</h2>
        <p className="muted small" style={{ marginTop: -6 }}>Always in the editor’s 🧰 Apps tab.</p>
        <div className="app-cards">
          {BUILTIN_APPS.map((b) => (
            <div key={b.id} className="card app-card">
              <div className="app-icon big">{b.icon}</div>
              <div className="grow"><b>{b.name}</b><div className="small muted">{b.desc}</div></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
