'use client';
import { useEffect, useState } from 'react';

// Contrast between two colors (WCAG): 1 (none) to 21 (black on white). 4.5 is the minimum for normal text.
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Look at each text on the page: is it readable against what's behind it, and big enough? */
async function check(design, page) {
  const { renderPageToCanvas } = await import('@/lib/export');
  const W = design.width, H = design.height;
  const s = Math.min(1, 900 / Math.max(W, H));
  // Draw the page without its text, then look at what's behind each text.
  const canvas = await renderPageToCanvas(design, { ...page, elements: page.elements.filter((e) => e.type !== 'text') }, s);
  const ctx = canvas.getContext('2d');
  const small = Math.min(W, H) * 0.016;
  const issues = [];
  for (const el of page.elements) {
    if (el.type !== 'text' || el.hidden || !el.text.trim()) continue;
    const fg = rgb(el.textGradient?.from || el.color);
    if (!fg) continue;
    let bg;
    if (el.bgColor && rgb(el.bgColor)) bg = rgb(el.bgColor);
    else {
      const x = Math.max(0, Math.floor(el.x * s)), y = Math.max(0, Math.floor(el.y * s));
      const w = Math.max(1, Math.min(canvas.width - x, Math.ceil(el.w * s))), h = Math.max(1, Math.min(canvas.height - y, Math.ceil(el.h * s)));
      if (w < 1 || h < 1) continue;
      const d = ctx.getImageData(x, y, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 10) { r += 255; g += 255; b += 255; } else { r += d[i]; g += d[i + 1]; b += d[i + 2]; } n++; }
      bg = [r / n, g / n, b / n];
    }
    const big = el.fontSize >= Math.min(W, H) * 0.03 || (el.fontWeight >= 700 && el.fontSize >= Math.min(W, H) * 0.024);
    const c = ratio(fg, bg);
    const need = big ? 3 : 4.5;
    const name = `“${el.text.slice(0, 40)}${el.text.length > 40 ? '…' : ''}”`;
    if (c < need && !el.strokeWidth && !el.glow?.size) {
      const better = ratio([0, 0, 0], bg) >= ratio([255, 255, 255], bg) ? '#111111' : '#ffffff';
      issues.push({ id: el.id, kind: 'contrast', text: `${name} is hard to read (contrast ${c.toFixed(1)}, needs ${need}).`, fix: { color: better, textGradient: null }, fixLabel: `Make it ${better === '#ffffff' ? 'white' : 'black'}` });
    }
    if (el.fontSize < small) {
      issues.push({ id: el.id, kind: 'size', text: `${name} is very small and may be hard to read.`, fix: { fontSize: Math.round(small * 1.25) }, fixLabel: 'Make it bigger' });
    }
  }
  return issues;
}

/** The "Accessibility check" app. api: { design, pages, pageIndex, updateElement(pi, id, patch), goTo(pi, id) } */
export default function A11yCheck({ api }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = [];
        for (let i = 0; i < api.pages.length; i++) for (const x of await check(api.design, api.pages[i])) out.push({ ...x, pi: i });
        if (alive) setRes(out);
      } catch (e) { if (alive) setErr(e.message || 'Could not check this design.'); }
    })();
    return () => { alive = false; };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>;
  if (!res) return <p className="small muted">Checking every page…</p>;
  if (!res.length) return <p className="small">✓ Looks good: all text is big enough and easy to read against its background.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        <span className="grow small">{res.length} thing{res.length === 1 ? '' : 's'} to look at</span>
        <button className="btn btn-sm btn-primary" onClick={() => { res.forEach((x) => api.updateElement(x.pi, x.id, x.fix)); setTimeout(() => setTick((t) => t + 1), 300); }}>Fix all</button>
      </div>
      <div className="spell-list">
        {res.map((x, i) => (
          <div key={i} className="spell-item">
            <div className="small">{x.kind === 'contrast' ? '🌗' : '🔎'} {x.text}</div>
            <div className="row wrap" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => api.goTo(x.pi, x.id)}>Show (page {x.pi + 1})</button>
              <button className="btn btn-sm btn-primary" onClick={() => { api.updateElement(x.pi, x.id, x.fix); setTimeout(() => setTick((t) => t + 1), 300); }}>{x.fixLabel}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
