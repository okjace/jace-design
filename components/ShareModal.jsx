'use client';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

const VIS = [
  ['private', 'Private', 'Only you and people you add'],
  ['link', 'Anyone with link', 'Not listed on your profile'],
  ['public', 'Public', 'On your profile & Explore'],
];

export const PERM_LABELS = [
  ['view', 'View'],
  ['comment', 'Comment'],
  ['download', 'Download'],
  ['print', 'Print'],
  ['remix', 'Make a copy / remix'],
  ['edit', 'Edit'],
];
export const PRESETS = {
  view: { view: true, comment: false, download: true, print: true, remix: true, edit: false },
  comment: { view: true, comment: true, download: true, print: true, remix: true, edit: false },
  edit: { view: true, comment: true, download: true, print: true, remix: true, edit: true },
};
export function presetOf(p) {
  for (const [k, v] of Object.entries(PRESETS)) if (Object.keys(v).every((x) => !!v[x] === !!p?.[x])) return k;
  return 'custom';
}

export function PermPicker({ value, onChange, compact }) {
  const preset = presetOf(value);
  const [custom, setCustom] = useState(preset === 'custom');
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {['view', 'comment', 'edit'].map((k) => (
          <button key={k} type="button" className={`btn btn-sm ${!custom && preset === k ? 'active' : ''}`} onClick={() => { setCustom(false); onChange({ ...PRESETS[k] }); }}>
            {k === 'view' ? '👁 Can view' : k === 'comment' ? '💬 Can comment' : '✏️ Can edit'}
          </button>
        ))}
        <button type="button" className={`btn btn-sm ${custom || preset === 'custom' ? 'active' : ''}`} onClick={() => setCustom(true)}>⚙️ Custom</button>
      </div>
      {custom || preset === 'custom' ? (
        <div className="row wrap" style={{ gap: compact ? 8 : 12 }}>
          {PERM_LABELS.map(([k, label]) => (
            <label key={k} className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={!!value?.[k]} disabled={k === 'view'} onChange={(e) => {
                const next = { ...value, [k]: e.target.checked };
                if (next.edit || next.comment) next.view = true;
                onChange(next);
              }} /> {label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ShareModal({ id, title, role, visibility, onVisibility, onClose, onPrint, onDownload }) {
  const [base, setBase] = useState('');
  const [copied, setCopied] = useState('');
  const [shares, setShares] = useState([]);
  const [requests, setRequests] = useState([]);
  const [guests, setGuests] = useState([]);
  const [peopleKey, setPeopleKey] = useState(0);
  const refreshPeople = () => setPeopleKey((k) => k + 1);

  // Keep access requests live too, so new ones show up while the window is open.
  useEffect(() => {
    if (role !== 'owner') return;
    const t = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/designs/${id}/requests`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) { setRequests(d.requests || []); setGuests(d.guests || []); } }).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [id, role]);
  const [username, setUsername] = useState('');
  const [perms, setPerms] = useState({ ...PRESETS.view });
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [linkPerms, setLinkPerms] = useState(null);
  const [requireRequest, setRequireRequest] = useState(false);
  const [social, setSocial] = useState(null);
  const [picked, setPicked] = useState({ friends: [], groups: [] });
  const [socialNote, setSocialNote] = useState('');
  const [socialMsg, setSocialMsg] = useState(null);
  const owner = role === 'owner';

  useEffect(() => {
    setBase(location.origin);
    if (owner) {
      fetch(`/api/designs/${id}/shares`).then((r) => r.json()).then((d) => setShares(d.shares || [])).catch(() => {});
      fetch(`/api/designs/${id}/requests`).then((r) => r.json()).then((d) => { setRequests(d.requests || []); setGuests(d.guests || []); }).catch(() => {});
      fetch(`/api/designs/${id}`).then((r) => r.json()).then((d) => {
        setLinkPerms(d.design?.link_perms || PRESETS.comment);
        setRequireRequest(!!d.design?.require_request);
        if (d.design?.default_person_perms) setPerms(d.design.default_person_perms);
      }).catch(() => {});
    }
    fetch('/api/social/contacts').then((r) => (r.ok ? r.json() : { connected: false, reason: 'signin' })).then(setSocial).catch(() => setSocial({ connected: false }));
  }, [id, owner]);

  const url = `${base}/d/${id}`;
  const embed = `<iframe src="${base}/d/${id}/embed" width="800" height="450" style="border:0;border-radius:12px" allowfullscreen></iframe>`;
  const enc = encodeURIComponent;
  const put = (body) => fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1800); } catch { prompt('Copy this:', text); }
  }

  async function addShare(e) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch(`/api/designs/${id}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, role: presetOf(perms), perms, message: note }) });
    const d = await r.json();
    if (!r.ok) return setMsg({ err: true, text: d.error });
    setShares(d.shares);
    refreshPeople();
    setMsg({ text: `Shared with @${username.replace(/^@/, '')}. We emailed them a link through Jace.` });
    setUsername(''); setNote('');
  }
  async function changeShare(s, p) {
    const r = await fetch(`/api/designs/${id}/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: s.username, role: presetOf(p), perms: p }) });
    if (r.ok) setShares((await r.json()).shares);
  }
  async function removeShare(uid) {
    const r = await fetch(`/api/designs/${id}/shares`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid }) });
    if (r.ok) setShares((await r.json()).shares);
  }
  async function answer(req, action, p) {
    const r = await fetch(`/api/designs/${id}/requests`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: req.id, action, role: presetOf(p), perms: p }) });
    if (r.ok) {
      const d = await r.json();
      setRequests(d.requests || []);
      setGuests(d.guests || []);
      fetch(`/api/designs/${id}/shares`).then((x) => x.json()).then((x) => setShares(x.shares || []));
      refreshPeople();
    }
  }
  async function guestAction(g, action, p) {
    const r = await fetch(`/api/designs/${id}/requests`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: g.id, action, perms: p }) });
    if (r.ok) { const d = await r.json(); setRequests(d.requests || []); setGuests(d.guests || []); }
  }
  async function sendSocial() {
    setSocialMsg(null);
    const r = await fetch('/api/social/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ design_id: id, message: socialNote, ...picked }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.reason) setSocial({ connected: false, reason: d.reason });
      return setSocialMsg({ err: true, text: d.error || 'Could not send' });
    }
    setSocialMsg(d.sent ? { text: `Sent to ${d.sent} chat${d.sent > 1 ? 's' : ''} on Jace Social.${d.failed ? ` ${d.failed} failed: ${d.error}` : ''}` } : { err: true, text: d.error || 'Nothing was sent.' });
    if (d.sent) { setPicked({ friends: [], groups: [] }); setSocialNote(''); }
  }
  const toggle = (kind, val) => setPicked((p) => ({ ...p, [kind]: p[kind].includes(val) ? p[kind].filter((x) => x !== val) : [...p[kind], val] }));
  const connectHref = `/api/auth/login?social=1&next=${enc(typeof location !== 'undefined' ? location.pathname + '?share=1' : `/d/${id}`)}`;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(620px, 100%)' }}>
        <div className="modal-head"><h3>Share “{title}”</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {owner && requests.length ? (
            <div className="card stack" style={{ padding: 14, borderColor: 'var(--brand)' }}>
              <h3 style={{ margin: 0 }}>🙋 Access requests ({requests.length})</h3>
              {requests.map((r) => <RequestRow key={r.id} r={r} onAnswer={answer} />)}
            </div>
          ) : null}

          {owner ? (
            <div className="stack">
              <h3 style={{ margin: 0 }}>Who can find it</h3>
              <div className="seg">
                {VIS.map(([v, t, d]) => (
                  <button key={v} className={visibility === v ? 'active' : ''} onClick={() => onVisibility(v)}><b>{t}</b><span>{d}</span></button>
                ))}
              </div>
              {visibility !== 'private' && linkPerms ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="small"><b>People with the link can:</b></div>
                  <PermPicker value={linkPerms} onChange={(p) => { setLinkPerms(p); put({ link_perms: p }); }} />
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" checked={requireRequest} onChange={(e) => { setRequireRequest(e.target.checked); put({ require_request: e.target.checked }); }} />
                    Make them ask me first (I approve each person)
                  </label>
                  <div className="small muted">People without a Jace account always have to type their name before they can open it.</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3>Link</h3>
            <div className="row">
              <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="btn btn-primary" onClick={() => copy(url, 'link')}>{copied === 'link' ? 'Copied!' : 'Copy'}</button>
            </div>
            {visibility === 'private' ? <div className="small muted" style={{ marginTop: 6 }}>Private: people who open the link can ask you for access.</div> : null}
          </div>

          {owner ? (
            <div>
              <h3>Add people</h3>
              <form className="stack" onSubmit={addShare}>
                <input className="input" placeholder="Jace username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <PermPicker value={perms} onChange={setPerms} compact />
                <input className="input" placeholder="Add a note (optional, goes in the email)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div><button className="btn" type="submit">Share & email them</button></div>
              </form>
              {msg ? <div className={`notice ${msg.err ? 'err' : 'ok'}`} style={{ marginTop: 10, marginBottom: 0 }}>{msg.text}</div> : null}
              <PeopleList id={id} reloadKey={peopleKey} />
            </div>
          ) : null}

          <div className="stack">
            <h3 style={{ margin: 0 }}>💬 Send on Jace Social</h3>
            {!social ? <div className="small muted">Loading…</div> : social.connected ? (
              <>
                {social.error ? <div className="notice err" style={{ margin: 0 }}>{social.error}</div> : null}
                {social.friends?.length || social.groups?.length ? (
                  <div className="stack" style={{ gap: 4, maxHeight: 180, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
                    {social.friends.map((f) => (
                      <label key={`f${f.id}`} className="row small"><input type="checkbox" checked={picked.friends.includes(f.id)} onChange={() => toggle('friends', f.id)} /> 👤 @{f.username || f.id}</label>
                    ))}
                    {social.groups.map((g) => (
                      <label key={`g${g.id}`} className="row small"><input type="checkbox" checked={picked.groups.includes(g.id)} onChange={() => toggle('groups', g.id)} /> 👥 {g.name} <span className="muted">({g.members})</span></label>
                    ))}
                  </div>
                ) : <div className="small muted">No Jace Social chats yet. Message someone on Jace Social first, then they’ll show up here.</div>}
                <input className="input" placeholder="Message (optional)" value={socialNote} onChange={(e) => setSocialNote(e.target.value)} />
                <div><button className="btn btn-primary" disabled={!picked.friends.length && !picked.groups.length} onClick={sendSocial}>Send to {picked.friends.length + picked.groups.length || ''} chat{picked.friends.length + picked.groups.length === 1 ? '' : 's'}</button></div>
                {socialMsg ? <div className={`notice ${socialMsg.err ? 'err' : 'ok'}`} style={{ margin: 0 }}>{socialMsg.text}</div> : null}
                {visibility === 'private' ? <div className="small muted">Tip: it&apos;s private, so friends will need to ask for access, unless you add them above.</div> : null}
              </>
            ) : social.reason === 'signin' ? (
              <div className="small muted">Sign in with Jace to send it to your friends.</div>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                <div className="small muted">Send this design to your Jace Social friends and group chats as a message from you. Jace will ask you to allow Jace Design to send messages.</div>
                <div><a className="btn btn-jace btn-sm" href={connectHref}>{social.reason === 'expired' ? 'Reconnect Jace Social' : 'Connect Jace Social'}</a></div>
              </div>
            )}
          </div>

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
              <input className="input" readOnly value={embed} onFocus={(e) => e.target.select()} style={{ fontFamily: 'Geist Mono, Fira Code, monospace', fontSize: 12 }} />
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

const STATUS = {
  added: ['Added', 'badge public'],
  approved: ['Approved', 'badge public'],
  link: ['Via link', 'badge link'],
  blocked: ['Blocked', 'badge'],
};

function ago(t) {
  if (!t) return '';
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

// Everyone who can open (or has opened) this design, with their own permissions.
const NO_ACCESS = { view: false, comment: false, download: false, print: false, remix: false, edit: false };

function PeopleList({ id, reloadKey }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');
  const pending = useRef(0); // changes still on their way to the server (don't let a refresh undo them)

  // Load now, then keep refreshing while the window is open (and the tab is visible), so new visitors appear by themselves.
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (pending.current || document.hidden) return;
      fetch(`/api/designs/${id}/people`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d && !pending.current) setData(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 3000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [id, reloadKey]);

  // Apply a change on screen right away, then confirm with the server.
  async function patch(body) {
    setData((d) => d && {
      ...d,
      people: (body.action === 'remove' ? d.people.filter((p) => p.key !== body.key) : d.people).map((p) => {
        if (p.key !== body.key) return p;
        if (body.action === 'block') return { ...p, status: 'blocked', custom: true, perms: NO_ACCESS, effective: NO_ACCESS };
        if (body.action === 'reset') return { ...p, status: 'link', custom: false, perms: null, effective: d.link_open ? d.link_perms : NO_ACCESS };
        return { ...p, status: p.kind === 'guest' ? 'approved' : 'added', custom: true, perms: body.perms, effective: body.perms };
      }),
    });
    pending.current++;
    try {
      const r = await fetch(`/api/designs/${id}/people`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { const d = await r.json(); if (pending.current === 1) setData(d); }
    } finally {
      pending.current--;
    }
  }
  if (!data) return <div className="small muted" style={{ marginTop: 12 }}>Loading people…</div>;
  const list = (data.people || []).filter((p) => !filter || `${p.name} ${p.username || ''}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="stack" style={{ marginTop: 16, gap: 8 }}>
      <div className="row">
        <b className="small grow">People with access ({data.people?.length || 0})</b>
        {data.people?.length > 5 ? <input className="input" style={{ width: 160, padding: '5px 8px', fontSize: 13 }} placeholder="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} /> : null}
      </div>
      <div className="small muted">Includes everyone who opened it with the link, signed in or as a guest. Change what each person can do, or block them.</div>
      {!list.length ? <div className="small muted">{data.people?.length ? 'No one matches.' : 'Nobody else has opened or been added to this yet.'}</div> : null}
      <div className="stack" style={{ gap: 8, maxHeight: 340, overflow: 'auto' }}>
        {list.map((p) => <PersonRow key={p.key} p={p} linkOpen={data.link_open} onPatch={patch} />)}
      </div>
    </div>
  );
}

function PersonRow({ p, linkOpen, onPatch }) {
  const [open, setOpen] = useState(false);
  const eff = p.effective || {};
  const can = PERM_LABELS.filter(([k]) => eff[k]).map(([, l]) => l.replace(' / remix', ''));
  const [label, cls] = STATUS[p.status] || STATUS.link;
  const role = { view: 'Can view', comment: 'Can comment', edit: 'Can edit', custom: 'Custom' }[presetOf(eff)];
  return (
    <div className="stack" style={{ gap: 6, padding: 8, border: '1px solid var(--line)', borderRadius: 10, opacity: p.status === 'blocked' ? 0.7 : 1 }}>
      <div className="row">
        <Avatar user={{ name: p.name, picture: p.picture }} size={30} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <b>{p.name}</b>
            <span className="muted small">{p.kind === 'guest' ? 'guest' : `@${p.username}`}</span>
            <span className={cls}>{label}</span>
          </div>
          <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.status === 'blocked' ? 'No access' : can.join(' · ') || 'No access'}
            {p.visits ? ` · opened ${p.visits}× · ${ago(p.last_seen)}` : ''}
            {!p.custom && p.status !== 'blocked' ? (linkOpen ? ' · using link settings' : ' · link is off') : ''}
          </div>
        </div>
        {p.status !== 'blocked' ? <button className={`btn btn-sm ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} title="Change what this person can do">{role} ▾</button> : null}
      </div>
      {open ? (
        <div style={{ paddingLeft: 38 }} className="stack">
          <PermPicker value={eff} onChange={(np) => onPatch({ key: p.key, perms: np })} compact />
        </div>
      ) : null}
      <div className="row wrap" style={{ gap: 6, paddingLeft: 38 }}>
        {p.status === 'blocked'
          ? <button className="btn btn-sm" onClick={() => onPatch({ key: p.key, action: 'reset' })}>Unblock</button>
          : <button className="btn btn-sm btn-danger" onClick={() => onPatch({ key: p.key, action: 'block' })}>Block</button>}
        {p.custom && p.status !== 'blocked' && linkOpen ? (
          <button className="btn btn-sm" onClick={() => onPatch({ key: p.key, action: 'reset' })} title="Use the same permissions as anyone with the link">
            Use link settings
          </button>
        ) : null}
        <span className="grow" />
        {p.status !== 'blocked' ? (
          <button
            className="btn btn-sm"
            title="Take away their access and remove them from this list"
            onClick={() => {
              if (linkOpen) {
                // With the link open they could just come back, so removing means blocking (Unblock undoes it).
                onPatch({ key: p.key, action: 'block' });
              } else if (confirm(`Remove ${p.name}? They won't be able to open this design anymore.`)) {
                onPatch({ key: p.key, action: 'remove' });
              }
            }}
          >🗑 Remove</button>
        ) : null}
      </div>
    </div>
  );
}

function ShareRow({ s, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const p = s.perms || PRESETS[s.role] || PRESETS.view;
  const label = { view: 'Can view', comment: 'Can comment', edit: 'Can edit', custom: 'Custom' }[presetOf(p)];
  const can = PERM_LABELS.filter(([k]) => p[k]).map(([, l]) => l.replace(' / remix', ''));
  return (
    <div className="stack" style={{ gap: 6, padding: 8, border: '1px solid var(--line)', borderRadius: 10 }}>
      <div className="row">
        <Avatar user={s} size={30} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div><b>{s.name}</b> <span className="muted small">{s.guest ? 'guest, no Jace account' : `@${s.username}`}</span></div>
          <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{can.join(' · ') || 'No access'}</div>
        </div>
        <button className={`btn btn-sm ${open ? 'active' : ''}`} onClick={() => setOpen(!open)} title="Change what this person can do">{label} ▾</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onRemove(s.user_id)} title="Remove access">✕</button>
      </div>
      {open ? <div style={{ paddingLeft: 38 }}><PermPicker value={p} onChange={(np) => onChange(s, np)} compact /></div> : null}
    </div>
  );
}

function RequestRow({ r, onAnswer }) {
  const [p, setP] = useState({ ...PRESETS.view });
  const who = r.username ? { name: r.name, username: r.username, picture: r.picture } : { name: r.guest_name || 'Guest' };
  return (
    <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
      <div className="row">
        <Avatar user={who} size={28} />
        <div className="grow"><b>{who.name}</b> <span className="muted small">{r.username ? `@${r.username}` : 'guest, no Jace account'}</span></div>
      </div>
      {r.message ? <div className="small" style={{ paddingLeft: 36 }}>“{r.message}”</div> : null}
      <div style={{ paddingLeft: 36 }} className="stack">
        <PermPicker value={p} onChange={setP} compact />
        <div className="row"><button className="btn btn-primary btn-sm" onClick={() => onAnswer(r, 'approve', p)}>Allow</button><button className="btn btn-sm btn-danger" onClick={() => onAnswer(r, 'deny', p)}>Deny</button></div>
      </div>
    </div>
  );
}
