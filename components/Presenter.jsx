'use client';
import { useEffect, useRef, useState } from 'react';
import DesignPage from './DesignPage';

export default function Presenter({ design, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const ref = useRef(null);
  const n = design.pages.length;
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(n - 1, x + 1)); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(n - 1);
      else if (e.key === 'Escape') onClose();
    };
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [n, onClose]);
  return (
    <div className="present" ref={ref} onClick={() => setI((x) => (x + 1 < n ? x + 1 : x))}>
      <DesignPage design={design} page={design.pages[i]} width="100%" height="100%" uidPrefix="present-" />
      <div className="present-hint">{i + 1} / {n} · ← → to move · Esc to exit</div>
    </div>
  );
}
