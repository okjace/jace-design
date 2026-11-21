'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Avatar from './Avatar';

const CAN = [['edit', 'edit'], ['comment', 'comment on'], ['view', 'view'], ['download', 'download'], ['print', 'print'], ['remix', 'copy']];
const canText = (p = {}) => CAN.filter(([k]) => p[k]).map(([, t]) => t).join(', ').replace(/, ([^,]*)$/, ' and $1');

function ago(t) {
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString();
}

const FILTERS = [['all', 'All'], ['share', 'Invites'], ['activity', 'Activity'], ['unread', 'Unread']];

export default function InboxList({ initial }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState('all');

  // Live: reload the list the moment the bell's connection says something changed
  // (plus a slow safety-net refresh in case live updates are blocked).
  useEffect(() => {
    const reload = () => fetch('/api/inbox', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setItems(d.items)).catch(() => {});
    const t = setInterval(() => { if (!document.hidden) reload(); }, 45000);
    window.addEventListener('jd-inbox-changed', reload);
    return () => { clearInterval(t); window.removeEventListener('jd-inbox-changed', reload); };
  }, []);

  async function send(body, optimistic) {
    if (optimistic) setItems(optimistic);
    const r = await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const d = await r.json();
      setItems(d.items);
      window.dispatchEvent(new CustomEvent('jd-inbox', { detail: d.unread }));
    }
  }
  const markRead = (n) => !n.read_at && send({ ids: [n.id] }, items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));

  const shown = items.filter((n) => filter === 'all' || (filter === 'share' ? n.type === 'share' : filter === 'unread' ? !n.read_at : n.type !== 'share'));
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row wrap">
        <div className="tabs grow" style={{ margin: 0 }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
              {l}{k === 'unread' && unread ? ` (${unread})` : k === 'share' ? ` (${items.filter((n) => n.type === 'share').length})` : ''}
            </button>
          ))}
        </div>
        {unread ? <button className="btn btn-sm" onClick={() => send({ all: true }, items.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))}>Mark all read</button> : null}
      </div>

      {!shown.length ? (
        <div className="card center muted">
          <p style={{ fontSize: 36, margin: 0 }}>📭</p>
          {filter === 'share' ? 'No invites yet. When someone shares a design with your Jace username, it shows up here.' : 'Nothing here yet.'}
        </div>
      ) : null}

      {shown.map((n) => {
        const who = { name: n.actor_name || n.actor_username || 'Someone', picture: n.actor_picture };
        const d = n.data || {};
        const title = n.design_title || 'a design';
        const editHref = `/design/${n.design_id}`;
        const viewHref = `/d/${n.design_id}`;
        let text; let href; let actions = null;
        if (n.type === 'share') {
          text = <><b>{who.name}</b> shared <b>{title}</b> with you{d.perms ? <> · you can {canText(d.perms)} it</> : null}</>;
          href = d.perms?.edit ? editHref : viewHref;
          actions = n.status === 'declined' ? <span className="badge">Declined</span> : (
            <>
              <Link className="btn btn-primary btn-sm" href={href} onClick={() => send({ id: n.id, action: 'accept' })}>{d.perms?.edit ? 'Open in editor' : 'Open'}</Link>
              <button className="btn btn-sm btn-danger" onClick={() => send({ id: n.id, action: 'decline' }, items.map((x) => (x.id === n.id ? { ...x, status: 'declined', read_at: x.read_at || new Date().toISOString() } : x)))}>Decline</button>
            </>
          );
        } else if (n.type === 'access_request') {
          text = <><b>{who.name}</b> asked for access to <b>{title}</b>{d.message ? <> · “{d.message}”</> : null}</>;
          href = `${editHref}?share=1`;
          actions = <Link className="btn btn-sm" href={href} onClick={() => markRead(n)}>Review</Link>;
        } else if (n.type === 'access_granted') {
          text = <><b>{who.name}</b> gave you access to <b>{title}</b></>;
          href = d.perms?.edit ? editHref : viewHref;
        } else if (n.type === 'comment') {
          text = <><b>{who.name}</b> commented on <b>{title}</b>{d.text ? <>: “{d.text}”</> : null}</>;
          href = `${viewHref}#comments`;
        } else if (n.type === 'remix') {
          text = <><b>{who.name}</b> remixed <b>{title}</b></>;
          href = n.actor_username ? `/u/${encodeURIComponent(n.actor_username)}` : viewHref;
        } else if (n.type === 'follow') {
          text = <><b>{who.name}</b> started following you</>;
          href = n.actor_username ? `/u/${encodeURIComponent(n.actor_username)}` : '/';
        } else {
          text = <>{who.name} · {n.type}</>;
          href = viewHref;
        }
        return (
          <div key={n.id} className={`inbox-item ${n.read_at ? '' : 'unread'}`}>
            <Avatar user={who} size={38} />
            <div className="grow" style={{ minWidth: 0 }}>
              <Link href={href || '#'} onClick={() => markRead(n)} style={{ display: 'block' }}>{text}</Link>
              <div className="small muted">{ago(n.created_at)}{n.type === 'share' && d.message ? ` · “${d.message}”` : ''}</div>
              {actions ? <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{actions}</div> : null}
            </div>
            {n.design_thumb ? <img src={n.design_thumb} alt="" className="inbox-thumb" /> : null}
            <button className="btn btn-ghost btn-sm" title="Remove from inbox" onClick={() => send({ id: n.id, action: 'delete' }, items.filter((x) => x.id !== n.id))}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
