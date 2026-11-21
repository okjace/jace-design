'use client';
import { useEffect, useRef, useState } from 'react';
import DesignPage from './DesignPage';

export default function Presenter({ design, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const ref = useRef(null);
  const n = design.pages.length;
  const nRef = useRef(n);
  nRef.current = n;
  // Keep the latest onClose without re-running the setup below (parents pass a new function every render).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let entered = false;
    const close = () => closeRef.current?.();
    const el = ref.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen().then(() => { entered = true; }).catch(() => {}); // still presents in the window if fullscreen is refused
    }
    const onKey = (e) => {
      const last = nRef.current - 1;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(last, x + 1)); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
      else if (e.key === 'Escape') close();
    };
    // Only close when the person leaves fullscreen after we actually entered it.
    const onFs = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  return (
    <div className="present" ref={ref} onClick={() => setI((x) => (x + 1 < n ? x + 1 : x))}>
      <DesignPage design={design} page={design.pages[Math.min(i, n - 1)]} width="100%" height="100%" uidPrefix="present-" />
      <div className="present-hint">
        {i + 1} / {n} · ← → to move · Esc to exit
        <button className="btn btn-sm" style={{ marginLeft: 12, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); closeRef.current?.(); }}>✕ Exit</button>
      </div>
    </div>
  );
}
