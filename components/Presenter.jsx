'use client';
import { useEffect, useRef, useState } from 'react';
import DesignPage from './DesignPage';

export default function Presenter({ design, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const [ready, setReady] = useState(false); // false until they press OK on the "Esc exits" notice
  const ref = useRef(null);
  const okRef = useRef(null);
  const entered = useRef(false);
  const n = design.pages.length;
  const nRef = useRef(n);
  nRef.current = n;
  const readyRef = useRef(false);
  readyRef.current = ready;
  // Keep the latest onClose without re-running the setup below (parents pass a new function every render).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    okRef.current?.focus();
    const close = () => closeRef.current?.();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (!readyRef.current) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
        return;
      }
      const last = nRef.current - 1;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(last, x + 1)); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
    };
    // Leaving fullscreen (the browser's own Esc) also ends the presentation.
    const onFs = () => {
      if (document.fullscreenElement) entered.current = true;
      else if (entered.current) close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function begin() {
    setReady(true);
    // Called from a click/keypress, so the browser allows fullscreen. If it's refused, present in the window.
    ref.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="present" ref={ref} onClick={() => ready && setI((x) => (x + 1 < n ? x + 1 : x))}>
      <DesignPage design={design} page={design.pages[Math.min(i, n - 1)]} width="100%" height="100%" uidPrefix="present-" />
      {ready ? (
        <div className="present-hint">{i + 1} / {n} · ← → to move</div>
      ) : (
        <div className="present-notice" onClick={(e) => e.stopPropagation()}>
          <div className="present-card">
            <div style={{ fontSize: 34 }}>⌨️</div>
            <b style={{ fontSize: 18 }}>Press Esc to exit</b>
            <span>Use ← → or click to change slides.</span>
            <button ref={okRef} className="btn btn-primary" onClick={begin}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
