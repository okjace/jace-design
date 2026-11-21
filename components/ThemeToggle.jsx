'use client';
import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  ['system', '💻', 'System'],
  ['light', '☀️', 'Light'],
  ['dark', '🌙', 'Dark'],
];

/** Light / Dark / System (default) theme picker. Saved in a cookie so the server renders the right theme. */
export default function ThemeToggle({ initial = 'system' }) {
  const [theme, setTheme] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function choose(t) {
    setTheme(t);
    setOpen(false);
    const root = document.documentElement;
    if (t === 'system') delete root.dataset.theme;
    else root.dataset.theme = t;
    document.cookie = `jd_theme=${t}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  const current = OPTIONS.find(([k]) => k === theme) || OPTIONS[0];
  return (
    <div className="usermenu" ref={ref}>
      <button className="inbox-bell" onClick={() => setOpen(!open)} title={`Theme: ${current[2]}`} aria-label="Choose light or dark theme">
        {current[1]}
      </button>
      {open ? (
        <div className="menu" style={{ minWidth: 170 }}>
          <div className="menu-head"><b>Theme</b></div>
          {OPTIONS.map(([k, icon, label]) => (
            <button key={k} onClick={() => choose(k)} style={{ fontWeight: k === theme ? 700 : 400 }}>
              {icon} {label}{k === 'system' ? ' (your device)' : ''}{k === theme ? ' ✓' : ''}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
