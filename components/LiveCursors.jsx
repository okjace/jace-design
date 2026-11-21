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
 * Live updates for the design editor. Nothing is sent or redrawn unless something changed:
 *  - your cursor/selection is sent only when it moves (at most ~3 times a second), plus a check-in every 20 s;
 *  - a quick read-only check (every 2 s while others are here, every 5 s when you're alone) says whether
 *    anyone moved or saved; the editor only updates when the answer is different.
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
    let stop = false, moveTimer = 0, checkTimer = 0, lastSent = '', lastSentAt = 0, lastPeople = '[]', pulling = false, alone = true;

    // Apply an answer from the server, but only touch the editor if something is different.
    const apply = async (d) => {
      if (stop || !d) return;
      const ppl = JSON.stringify(d.people || []);
      if (ppl !== lastPeople) { lastPeople = ppl; setPeople(d.people || []); }
      alone = !(d.people || []).length;
      if (d.color) setColor((c) => (c === d.color ? c : d.color));
      const sv = state.current.saver;
      // Someone saved: if we have nothing unsaved, load their version (if we do, saving merges it in).
      if (d.version && sv && d.version !== sv.version() && !sv.hasUnsaved() && sv.state === 'saved' && !pulling) {
        pulling = true;
        try {
          const g = await fetch(`/api/designs/${id}`, { cache: 'no-store' });
          const j = await g.json();
          if (g.ok && j.design && !stop && !sv.hasUnsaved()) state.current.onRemote?.(j.design.data, j.design.title, j.version || d.version);
        } catch {} finally { pulling = false; }
      }
    };

    const post = async (body) => {
      try {
        const r = await fetch(`/api/designs/${id}/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (r.ok) await apply(await r.json());
      } catch {}
    };

    // Your cursor: only sent when it changed.
    const watchMoves = () => {
      if (stop) return;
      if (!document.hidden) {
      const pos = posRef.current;
        const body = { sess, page: state.current.page, x: pos ? Math.round(pos.x) : null, y: pos ? Math.round(pos.y) : null, sel: selRef.current || null };
        const sig = JSON.stringify(body);
        const now = Date.now();
        if (sig !== lastSent || now - lastSentAt > 20_000) { lastSent = sig; lastSentAt = now; post(body); }
      }
      moveTimer = setTimeout(watchMoves, 300);
    };

    // Others: a cheap read, more often only when someone else is here.
    const check = async () => {
      if (stop) return;
      if (!document.hidden && Date.now() - lastSentAt > 1500) {
        try {
          const r = await fetch(`/api/designs/${id}/presence?sess=${sess}`, { cache: 'no-store' });
          if (r.ok) await apply(await r.json());
        } catch {}
      }
      if (!stop) checkTimer = setTimeout(check, alone ? 5000 : 2000);
    };

    watchMoves();
    checkTimer = setTimeout(check, 2000);
    const bye = () => {
      try { navigator.sendBeacon?.(`/api/designs/${id}/presence`, new Blob([JSON.stringify({ sess, leave: true })], { type: 'application/json' })); } catch {}
    };
    window.addEventListener('pagehide', bye);
    return () => { stop = true; clearTimeout(moveTimer); clearTimeout(checkTimer); window.removeEventListener('pagehide', bye); bye(); };
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
