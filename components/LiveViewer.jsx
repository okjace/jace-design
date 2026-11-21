'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import DesignPage from './DesignPage';

/** A viewer following a live presentation: shows whatever slide the presenter is on. */
export default function LiveViewer({ id, title, design }) {
  const [state, setState] = useState({ live: false, page: 0, connecting: true });
  const boxRef = useRef(null);
  const n = design.pages.length;

  useEffect(() => {
    let es = null;
    const open = () => {
      if (es) return;
      es = new EventSource(`/api/designs/${id}/present`);
      es.addEventListener('slide', (e) => { try { setState({ ...JSON.parse(e.data), connecting: false }); } catch {} });
      es.onerror = () => setState((s) => ({ ...s, connecting: true }));
    };
    open();
    const onVis = () => { if (document.hidden) { es?.close(); es = null; } else open(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { es?.close(); document.removeEventListener('visibilitychange', onVis); };
  }, [id]);

  const page = design.pages[Math.min(state.page || 0, n - 1)];

  return (
    <div className="live-view" ref={boxRef}>
      <div className="live-view-top">
        <Link href={`/d/${id}`} className="btn btn-sm">← {title}</Link>
        <span className={`live-pill ${state.live ? 'on' : ''}`}>{state.live ? `● Live${state.by ? ` · ${state.by} is presenting` : ''}` : state.connecting ? 'Connecting…' : 'Waiting for the presenter'}</span>
        <div className="grow" />
        {state.live ? <span className="small" style={{ color: 'rgba(255,255,255,.7)' }}>Slide {Math.min(state.page + 1, n)} / {n}</span> : null}
        <button className="btn btn-sm" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : boxRef.current?.requestFullscreen?.())}>⛶ Full screen</button>
      </div>
      <div className="live-view-stage">
        {state.live ? (
          <DesignPage design={design} page={page} width="100%" height="100%" uidPrefix="live-" media="autoplay" />
        ) : (
          <div className="live-wait">
            <div style={{ fontSize: 46 }}>📡</div>
            <b>{state.connecting ? 'Connecting…' : 'The presentation hasn’t started yet'}</b>
            <span>Keep this page open. The slides appear here as soon as the presenter starts.</span>
          </div>
        )}
      </div>
    </div>
  );
}
