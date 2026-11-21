'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * Watches an open editor's access live. Returns { lost, view, setLost } and calls onLost() once
 * when the person can no longer edit (removed, blocked, made view-only, or the design was deleted).
 */
export function useAccessWatch(id, role, onLost) {
  const [lost, setLost] = useState(null); // null | { reason, view }
  const cb = useRef(onLost);
  cb.current = onLost;
  useEffect(() => {
    if (role === 'owner') return undefined; // owners can't lose access to their own design
    let es = null;
    const open = () => {
      if (es || typeof EventSource === 'undefined') return;
      es = new EventSource(`/api/designs/${id}/live`);
      es.addEventListener('access', (e) => {
        try {
          const s = JSON.parse(e.data);
          if (s.status === 'deleted' || s.status === 'removed' || !s.edit) {
            setLost((cur) => cur || { reason: s.status === 'deleted' ? 'deleted' : s.view ? 'viewonly' : 'removed', view: !!s.view });
          }
        } catch {}
      });
    };
    const close = () => { if (es) { es.close(); es = null; } };
    open();
    const onVis = () => (document.hidden ? close() : open());
    document.addEventListener('visibilitychange', onVis);
    return () => { close(); document.removeEventListener('visibilitychange', onVis); };
  }, [id, role]);
  useEffect(() => { if (lost) cb.current?.(lost); }, [lost]);
  return { lost, setLost };
}

/** Full-screen notice shown when someone loses edit access while editing. */
export function AccessLost({ id, lost }) {
  if (!lost) return null;
  const text = {
    deleted: ['This design was deleted', 'The owner deleted it, so it can’t be edited anymore.'],
    viewonly: ['You can only view this now', 'The owner changed your access, so you can’t edit it anymore. Your last changes may not have been saved.'],
    removed: ['You no longer have access', 'The owner removed you from this design. Your last changes may not have been saved.'],
  }[lost.reason] || ['You no longer have access', ''];
  return (
    <div className="modal-back" style={{ zIndex: 900 }}>
      <div className="modal" style={{ width: 'min(440px, 100%)' }}>
        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 44 }}>🔒</div>
          <h3 style={{ margin: 0, fontSize: 20 }}>{text[0]}</h3>
          <p className="muted" style={{ margin: 0 }}>{text[1]}</p>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            {lost.view ? <a className="btn btn-primary" href={`/d/${id}`}>View it</a> : null}
            {lost.reason !== 'deleted' && !lost.view ? <a className="btn btn-primary" href={`/d/${id}`}>Ask for access</a> : null}
            <Link className="btn" href="/">Go home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
