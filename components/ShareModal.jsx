'use client';
import { useEffect, useState } from 'react';
import Avatar from './Avatar';

const VIS = [
  ['private', 'Private', 'Only you and people you add'],
  ['link', 'Anyone with link', 'Not listed on your profile'],
  ['public', 'Public', 'On your profile & Explore'],
];

export default function ShareModal({ id, title, role, visibility, onVisibility, onClose, onPrint, onDownload }) {
  const [base, setBase] = useState('');
  const [copied, setCopied] = useState('');
  const [shares, setShares] = useState([]);
  const [username, setUsername] = useState('');
  const [shareRole, setShareRole] = useState('view');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const owner = role === 'owner';

  useEffect(() => {
    setBase(location.origin);
    if (owner) fetch(`/api/designs/${id}/shares`).then((r) => r.json()).then((d) => setShares(d.shares || [])).catch(() => {});
  }, [id, owner]);

  const url = `${base}/d/${id}`;
  const embed = `<iframe src="${base}/d/${id}/embed" width="800" height="450" style="border:0;border-radius:12px" allowfullscreen></iframe>`;
  const enc = encodeURIComponent;

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1800); } catch { prompt('Copy this:', text); }
  }

  async function addShare(e) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch(`/api/designs/${id}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, role: shareRole, message: note }) });
    const d = await r.json();
    if (!r.ok) return setMsg({ err: true, text: d.error });
    setShares(d.shares);
    setMsg({ text: `Shared with @${username.replace(/^@/, '')}. We emailed them a link through Jace.` });
    setUsername(''); setNote('');
  }

  async function removeShare(uid) {
    const r = await fetch(`/api/designs/${id}/shares`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid }) });
    const d = await r.json();
    if (r.ok) setShares(d.shares);
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>Share “{title}”</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {owner ? (
            <div>
              <h3>Who can see it</h3>
              <div className="seg">
                {VIS.map(([v, t, d]) => (
                  <button key={v} className={visibility === v ? 'active' : ''} onClick={() => onVisibility(v)}><b>{t}</b><span>{d}</span></button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h3>Link</h3>
            <div className="row">
              <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="btn btn-primary" onClick={() => copy(url, 'link')}>{copied === 'link' ? 'Copied!' : 'Copy'}</button>
            </div>
            {visibility === 'private' ? <div className="small muted" style={{ marginTop: 6 }}>This design is private, so the link only works for you and people you add below.</div> : null}
          </div>

          {owner ? (
            <div>
              <h3>Share with Jace people</h3>
              <form className="stack" onSubmit={addShare}>
                <div className="row">
                  <input className="input" placeholder="Jace username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  <select className="input" style={{ width: 120 }} value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                    <option value="view">Can view</option>
                    <option value="edit">Can edit</option>
                  </select>
                </div>
                <input className="input" placeholder="Add a note (optional, goes in the email)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div><button className="btn" type="submit">Share & email them</button></div>
              </form>
              {msg ? <div className={`notice ${msg.err ? 'err' : 'ok'}`} style={{ marginTop: 10, marginBottom: 0 }}>{msg.text}</div> : null}
              {shares.length ? (
                <div className="stack" style={{ marginTop: 10, gap: 4 }}>
                  {shares.map((s) => (
                    <div className="row" key={s.user_id}>
                      <Avatar user={s} size={28} />
                      <div className="grow"><b>{s.name}</b> <span className="muted small">@{s.username}</span></div>
                      <span className="badge">{s.role === 'edit' ? 'Can edit' : 'Can view'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeShare(s.user_id)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3>Share to</h3>
            <div className="share-icons">
              {typeof navigator !== 'undefined' && navigator.share ? <button className="btn btn-sm" onClick={() => navigator.share({ title, url }).catch(() => {})}>📤 More…</button> : null}
              <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}>𝕏 Post</a>
              <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}>Facebook</a>
              <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}>LinkedIn</a>
              <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`}>Reddit</a>
              <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(title)}`}>Pinterest</a>
              <a className="btn btn-sm" href={`mailto:?subject=${enc(title)}&body=${enc(`Check out this design: ${url}`)}`}>✉️ Email</a>
            </div>
          </div>

          <div>
            <h3>Embed</h3>
            <div className="row">
              <input className="input" readOnly value={embed} onFocus={(e) => e.target.select()} style={{ fontFamily: 'Fira Code, monospace', fontSize: 12 }} />
              <button className="btn" onClick={() => copy(embed, 'embed')}>{copied === 'embed' ? 'Copied!' : 'Copy'}</button>
            </div>
            {visibility === 'private' ? <div className="small muted" style={{ marginTop: 6 }}>Embeds need the design to be public or link-shared.</div> : null}
          </div>

          {onPrint || onDownload ? (
            <div className="row wrap">
              {onDownload ? <button className="btn" onClick={onDownload}>⬇️ Download</button> : null}
              {onPrint ? <button className="btn" onClick={onPrint}>🖨️ Print</button> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
