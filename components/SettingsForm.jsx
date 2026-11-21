'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import { PermPicker } from './ShareModal';

const REASONS = {
  no_email: "Your Jace account doesn't have a confirmed email yet. Add one in your Jace account settings.",
  turned_off: 'You turned off "Emails from Jace\'s apps" in your Jace account, so Jace didn\'t send it.',
  not_configured: "Email isn't set up on this server yet (JACE_CLIENT_ID / JACE_CLIENT_SECRET missing).",
  rate_limited: 'Too many emails today. Try again tomorrow.',
  unauthorized_client: 'Jace says this app is not an official Jace app, so it can’t send emails.',
  not_found: 'Jace says you haven’t signed in to this app yet. Sign out and back in, then try again.',
  invalid_client: 'Jace rejected the app’s client ID or secret.',
};

function SharingDefaults({ initial }) {
  const [d, setD] = useState(initial);
  const [msg, setMsg] = useState('');
  async function save(next) {
    setD(next);
    setMsg('Saving…');
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share_defaults: next }) });
    setMsg(r.ok ? 'Saved ✓' : 'Could not save');
  }
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <h3 style={{ margin: 0 }}>🔐 Default sharing</h3>
      <p className="muted small" style={{ margin: 0 }}>Every new design and document starts with these settings. You can still change them for each design in its Share window.</p>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Who can find new designs</b>
        <div className="seg">
          {[['private', 'Private', 'Only you and people you add'], ['link', 'Anyone with link', 'Not on your profile'], ['public', 'Public', 'On your profile & Explore']].map(([v, t, s]) => (
            <button key={v} type="button" className={d.visibility === v ? 'active' : ''} onClick={() => save({ ...d, visibility: v })}><b>{t}</b><span>{s}</span></button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">People with the link can</b>
        <PermPicker value={d.link_perms} onChange={(p) => save({ ...d, link_perms: p })} />
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={d.require_request} onChange={(e) => save({ ...d, require_request: e.target.checked })} />
          Make them ask me first
        </label>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">People I add by username get</b>
        <PermPicker value={d.person_perms} onChange={(p) => save({ ...d, person_perms: p })} />
      </div>
      {msg ? <div className="small muted">{msg}</div> : null}
    </div>
  );
}

export default function SettingsForm({ user, configured, defaults }) {
  const [bio, setBio] = useState(user.bio || '');
  const [website, setWebsite] = useState(user.website || '');
  const [notify, setNotify] = useState(user.email_notify);
  const [status, setStatus] = useState(null);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);

  async function save(e) {
    e?.preventDefault();
    setStatus({ text: 'Saving…' });
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio, website, email_notify: notify }) });
    setStatus(r.ok ? { ok: true, text: 'Saved ✓' } : { err: true, text: 'Could not save' });
  }

  async function sendTest() {
    setTesting(true);
    setTest(null);
    try {
      const r = await fetch('/api/settings/test-email', { method: 'POST' });
      const d = await r.json();
      if (d.sent) setTest({ ok: true, text: 'Test email sent! Check your inbox.' });
      else setTest({ err: true, text: REASONS[d.reason] || `Not sent: ${d.detail || d.reason || 'unknown error'}` });
    } catch {
      setTest({ err: true, text: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <form className="card stack" onSubmit={save}>
        <div className="row">
          <Avatar user={user} size={56} />
          <div><b>{user.name}</b><div className="muted small">@{user.username}</div></div>
          <a className="btn btn-sm" style={{ marginLeft: 'auto' }} href="https://jaceo.vercel.app" target="_blank" rel="noreferrer">Change on Jace ↗</a>
        </div>
        <label className="field">Bio<textarea className="input" maxLength={300} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people what you make" /></label>
        <label className="field">Website<input className="input" maxLength={200} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" /></label>
        <div className="row"><button className="btn btn-primary">Save profile</button>{status ? <span className={status.err ? 'btn-danger' : 'muted'}>{status.text}</span> : null}</div>
      </form>

      {defaults ? <SharingDefaults initial={defaults} /> : null}

      <div className="card stack">
        <h3 style={{ margin: 0 }}>📧 Emails</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Jace Design emails you through your Jace account (we never see your address) when someone comments on, remixes or shares a design with you, or follows you.
        </p>
        <label className="row">
          <input type="checkbox" checked={notify} onChange={(e) => { setNotify(e.target.checked); }} />
          Email me about activity on Jace Design
        </label>
        <div className="row wrap">
          <button className="btn" type="button" onClick={save}>Save email setting</button>
          <button className="btn btn-primary" type="button" disabled={testing || !configured} onClick={sendTest}>{testing ? 'Sending…' : '✉️ Send test email'}</button>
        </div>
        {!configured ? <div className="notice">Email isn&apos;t set up on this server yet.</div> : null}
        {test ? <div className={`notice ${test.err ? 'err' : 'ok'}`} style={{ marginBottom: 0 }}>{test.text}</div> : null}
      </div>
    </div>
  );
}
