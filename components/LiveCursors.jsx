'use client';
import { useEffect, useRef, useState } from 'react';

const sessId = () => {
  try {
    let s = sessionStorage.getItem('jd_live_sess');
    if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('jd_live_sess', s); }
    return s;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
};

/**
 * Live mode for the design editor (only while `on`): shares your cursor, shows everyone else's who also
 * has Live on, and pulls in their saved changes whenever you have nothing unsaved yourself.
 * posRef.current = { x, y } in design units (or null); selRef.current = selected element id.
 */
export function useLive({ id, on, page, posRef, selRef, saver, onRemote }) {
  const [people, setPeople] = useState([]);
  const [color, setColor] = useState('');
  const state = useRef({});
  state.current = { page, saver, onRemote };

  useEffect(() => {
    if (!on) { setPeople([]); return undefined; }
    const sess = sessId();
    let stop = false, timer = 0, last = '', lastSent = 0, pulling = false;
    const tick = async () => {
      if (stop) return;
      const { page: pg, saver: sv } = state.current;
      const pos = posRef.current;
      const body = { sess, page: pg, x: pos ? Math.round(pos.x) : null, y: pos ? Math.round(pos.y) : null, sel: selRef.current || null };
      const sig = JSON.stringify(body);
      const now = Date.now();
      // Send when something moved (up to ~4 times a second), otherwise a heartbeat every 1.2 s.
      if (!document.hidden && (sig !== last || now - lastSent > 1200)) {
        last = sig; lastSent = now;
        try {
          const r = await fetch(`/api/designs/${id}/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: sig });
          if (r.ok) {
            const d = await r.json();
            if (!stop) { setPeople(d.people || []); setColor(d.color || ''); }
            // Someone saved a newer version: if we have nothing unsaved, load it.
            if (d.version && sv && d.version !== sv.version() && !sv.hasUnsaved() && sv.state === 'saved' && !pulling) {
              pulling = true;
              try {
                const g = await fetch(`/api/designs/${id}`);
                const j = await g.json();
                if (g.ok && j.design && !stop && !sv.hasUnsaved()) state.current.onRemote?.(j.design.data, j.design.title, j.version || d.version);
              } catch {} finally { pulling = false; }
            }
          }
        } catch {}
      }
      if (!stop) timer = setTimeout(tick, 250);
    };
    tick();
    const bye = () => {
      try { navigator.sendBeacon?.(`/api/designs/${id}/presence`, new Blob([JSON.stringify({ sess, leave: true })], { type: 'application/json' })); } catch {}
    };
    window.addEventListener('pagehide', bye);
    return () => { stop = true; clearTimeout(timer); window.removeEventListener('pagehide', bye); bye(); };
  }, [id, on]); // eslint-disable-line react-hooks/exhaustive-deps

  return { people, color };
}

/** Other people's cursors and selections, drawn over the canvas. */
export function LiveLayer({ people, page, zoom, elements }) {
  return (
    <>
      {people.filter((p) => p.page === page).map((p) => {
        const el = p.sel ? elements.find((e) => e.id === p.sel) : null;
        return (
          <div key={p.sess}>
            {el ? (
              <div className="live-sel" style={{ left: el.x * zoom, top: el.y * zoom, width: el.w * zoom, height: el.h * zoom, transform: `rotate(${el.rotation || 0}deg)`, borderColor: p.color }} />
            ) : null}
            {p.x != null && p.y != null ? (
              <div className="live-cursor" style={{ transform: `translate(${p.x * zoom}px, ${p.y * zoom}px)` }}>
                <svg width="18" height="20" viewBox="0 0 18 20"><path d="M1 1l15 7-6.5 2L7 18z" fill={p.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                <span style={{ background: p.color }}>{p.name}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
