// Charts, tables and QR codes. Each one is laid out here as simple pieces (rectangles, text, paths)
// that both renderers draw: the SVG one on screen (components/DesignPage.jsx) and the canvas one for
// downloads, video and presenting (lib/export.js). So they always look the same everywhere.
import qrcode from 'qrcode-generator';

export const BLOCK_TYPES = ['chart', 'table', 'qr'];
export const CHART_COLORS = ['#1f9d5a', '#155dfc', '#f97316', '#7c3aed', '#ec4899', '#facc15', '#06b6d4', '#ef4444', '#84cc16', '#475569'];
export const CHART_TYPES = [['bar', 'Bars'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['donut', 'Donut']];

/** A page's background, following "same as the previous page" back to a real one. */
export function resolveBg(design, page) {
  const bg = page?.background;
  if (bg?.type !== 'same') return bg;
  const pages = design?.pages || [];
  let i = pages.findIndex((p) => p.id === page.id);
  while (i > 0) {
    i -= 1;
    const b = pages[i].background;
    if (b?.type !== 'same') return b;
  }
  return { type: 'color', color: '#ffffff' };
}

// ---------- QR codes ----------
const qrCache = new Map();
export function qrMatrix(text) {
  const key = String(text ?? '').slice(0, 1200) || ' ';
  if (qrCache.has(key)) return qrCache.get(key);
  let m = null;
  try {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, 'M');
    q.addData(key, 'Byte');
    q.make();
    const n = q.getModuleCount();
    m = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
  } catch {
    m = null; // too long for a QR code
  }
  if (qrCache.size > 60) qrCache.delete(qrCache.keys().next().value);
  qrCache.set(key, m);
  return m;
}

function qrShapes(el) {
  const out = [];
  const size = Math.min(el.w, el.h);
  const x0 = el.x + (el.w - size) / 2, y0 = el.y + (el.h - size) / 2;
  if (el.bg) out.push({ k: 'rect', x: x0, y: y0, w: size, h: size, fill: el.bg, r: el.radius || 0 });
  const m = qrMatrix(el.text);
  if (!m) {
    out.push({ k: 'text', x: x0 + size / 2, y: y0 + size / 2, text: 'Too long', size: size / 10, color: el.color || '#000', anchor: 'middle', font: 'Inter' });
    return out;
  }
  const n = m.length + 4; // 2 modules of quiet space on each side
  const s = size / n;
  let d = '';
  m.forEach((row, r) => row.forEach((on, c) => {
    if (on) d += `M${(x0 + (c + 2) * s).toFixed(2)} ${(y0 + (r + 2) * s).toFixed(2)}h${(s + 0.02).toFixed(2)}v${(s + 0.02).toFixed(2)}h${(-s - 0.02).toFixed(2)}z`;
  }));
  out.push({ k: 'path', d, fill: el.color || '#000000' });
  return out;
}

// ---------- tables ----------
function tableShapes(el) {
  const out = [];
  const rows = Array.isArray(el.rows) && el.rows.length ? el.rows : [['']];
  const nr = rows.length;
  const nc = Math.max(1, ...rows.map((r) => r.length));
  const rh = el.h / nr, cw = el.w / nc;
  const fs = el.fontSize || Math.max(8, Math.min(rh * 0.42, 40));
  const pad = fs * 0.55;
  const radius = el.radius || 0;
  out.push({ k: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, fill: el.cellBg || '#ffffff', r: radius });
  rows.forEach((row, r) => {
    const head = el.header !== false && r === 0;
    const fill = head ? el.headerBg || '#1f9d5a' : el.stripe && r % 2 === 0 ? el.stripe : null;
    if (fill) out.push({ k: 'rect', x: el.x, y: el.y + r * rh, w: el.w, h: rh, fill, r: head && radius ? Math.min(radius, rh / 2) : 0, topOnly: head && radius });
    for (let c = 0; c < nc; c++) {
      const text = String(row[c] ?? '');
      if (!text) continue;
      const align = el.align || 'left';
      const x = align === 'center' ? el.x + c * cw + cw / 2 : align === 'right' ? el.x + (c + 1) * cw - pad : el.x + c * cw + pad;
      out.push({
        k: 'text', x, y: el.y + r * rh + rh / 2 + fs * 0.35, text: fitText(text, cw - pad * 2, fs, head ? 700 : 400), size: fs,
        color: head ? el.headerColor || '#ffffff' : el.color || '#16181d', weight: head ? 700 : 400, font: el.fontFamily || 'Inter',
        anchor: align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start',
      });
    }
  });
  const border = el.border ?? '#dfe2e7';
  if (border) {
    const sw = Math.max(1, fs / 18);
    let d = '';
    for (let r = 1; r < nr; r++) d += `M${el.x} ${el.y + r * rh}H${el.x + el.w}`;
    if (el.grid !== false) for (let c = 1; c < nc; c++) d += `M${el.x + c * cw} ${el.y}V${el.y + el.h}`;
    if (d) out.push({ k: 'path', d, stroke: border, sw });
    out.push({ k: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, stroke: border, sw, r: radius });
  }
  return out;
}

// Rough text width (no fonts needed, so it works on the server too) used to keep labels inside their space.
const approxW = (s, size, weight = 400) => [...s].length * size * (weight >= 700 ? 0.6 : 0.55);
function fitText(s, max, size, weight) {
  if (approxW(s, size, weight) <= max) return s;
  const chars = [...s];
  while (chars.length > 1 && approxW(chars.join('') + '…', size, weight) > max) chars.pop();
  return chars.join('') + '…';
}

// ---------- charts ----------
export function fmtNum(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(n / 1e3).toFixed(1)}k`;
  return String(+n.toFixed(2));
}
function niceStep(range) {
  const raw = range / 4 || 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Chart data as editable text: first line is "Label, Series 1, Series 2…", then one line per item. */
export function chartToCsv(c) {
  const series = c?.series || [];
  const head = ['Label', ...series.map((s) => s.name || 'Value')].join(', ');
  const lines = (c?.labels || []).map((l, i) => [l, ...series.map((s) => s.values?.[i] ?? 0)].join(', '));
  return [head, ...lines].join('\n');
}
export function csvToChart(text, prev = {}) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.split(/[,\t;]/).map((x) => x.trim())).filter((l) => l.some(Boolean));
  if (!lines.length) return { ...prev, labels: [], series: [] };
  const head = lines[0];
  const firstIsHeader = head.slice(1).some((x) => x && !Number.isFinite(Number(x.replace(/[$%,]/g, ''))));
  const body = firstIsHeader ? lines.slice(1) : lines;
  const names = firstIsHeader ? head.slice(1) : ['Value'];
  const ns = Math.max(1, names.length, ...body.map((l) => l.length - 1));
  const series = Array.from({ length: Math.min(8, ns) }, (_, s) => ({
    name: names[s] || `Series ${s + 1}`,
    color: prev.series?.[s]?.color || CHART_COLORS[s % CHART_COLORS.length],
    values: body.map((l) => Number(String(l[s + 1] ?? '0').replace(/[$%,]/g, '')) || 0),
  }));
  return { ...prev, labels: body.map((l) => l[0] || '').slice(0, 60), series: series.map((s) => ({ ...s, values: s.values.slice(0, 60) })) };
}

const arcPt = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
function wedge(cx, cy, r, ri, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // A full circle can't be one arc: draw it as two halves.
    const mid = a0 + Math.PI;
    return wedge(cx, cy, r, ri, a0, mid) + wedge(cx, cy, r, ri, mid, a1);
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = arcPt(cx, cy, r, a0), [x1, y1] = arcPt(cx, cy, r, a1);
  if (!ri) return `M${cx} ${cy}L${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}Z`;
  const [x2, y2] = arcPt(cx, cy, ri, a1), [x3, y3] = arcPt(cx, cy, ri, a0);
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${large} 0 ${x3} ${y3}Z`;
}
const dot = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

function chartShapes(el) {
  const out = [];
  const c = el.chart || {};
  const type = c.type || 'bar';
  const labels = c.labels || [];
  const series = (c.series || []).filter((s) => Array.isArray(s.values));
  const font = el.fontFamily || 'Inter';
  const color = el.color || '#16181d';
  const fs = el.fontSize || Math.max(8, Math.min(el.w, el.h) * 0.045);
  if (el.bg) out.push({ k: 'rect', x: el.x, y: el.y, w: el.w, h: el.h, fill: el.bg, r: el.radius || 0 });
  const pad = el.bg ? fs * 0.8 : 0;
  let top = el.y + pad;
  if (c.title) {
    out.push({ k: 'text', x: el.x + el.w / 2, y: top + fs * 1.2, text: c.title, size: fs * 1.25, weight: 700, color, font, anchor: 'middle' });
    top += fs * 2;
  }
  const L = el.x + pad, R = el.x + el.w - pad, B = el.y + el.h - pad;

  if (type === 'pie' || type === 'donut') {
    const vals = (series[0]?.values || []).map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const legend = c.legend !== false;
    const legendW = legend ? Math.min((R - L) * 0.42, Math.max(...labels.map((l) => approxW(l, fs)), 0) + fs * 2.2) : 0;
    const r = Math.max(4, Math.min((R - L - legendW) / 2, (B - top) / 2) * 0.96);
    const cx = L + (R - L - legendW) / 2, cy = top + (B - top) / 2;
    const ri = type === 'donut' ? r * 0.58 : 0;
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      if (!v) return;
      const a1 = a + (v / total) * Math.PI * 2;
      const col = c.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length];
      out.push({ k: 'path', d: wedge(cx, cy, r, ri, a, a1), fill: col, stroke: el.bg || (ri ? null : '#ffffff'), sw: ri ? 0 : Math.max(1, r / 80) });
      if (c.values !== false && v / total > 0.045) {
        const [tx, ty] = arcPt(cx, cy, ri ? (r + ri) / 2 : r * 0.64, (a + a1) / 2);
        out.push({ k: 'text', x: tx, y: ty + fs * 0.35, text: `${Math.round((v / total) * 100)}%`, size: fs * 0.9, weight: 700, color: '#ffffff', font, anchor: 'middle' });
      }
      a = a1;
    });
    if (legend) {
      const lx = R - legendW + fs * 0.4;
      const step = fs * 1.6;
      let ly = cy - ((labels.length - 1) * step) / 2;
      labels.forEach((l, i) => {
        out.push({ k: 'rect', x: lx, y: ly - fs * 0.45, w: fs * 0.9, h: fs * 0.9, r: fs * 0.2, fill: c.colors?.[i] || CHART_COLORS[i % CHART_COLORS.length] });
        out.push({ k: 'text', x: lx + fs * 1.4, y: ly + fs * 0.35, text: fitText(l, legendW - fs * 1.8, fs), size: fs, color, font });
        ly += step;
      });
    }
    return out;
  }

  // Bars, lines and areas share axes.
  if (series.length > 1 && c.legend !== false) {
    let lx = L;
    series.forEach((s, i) => {
      const col = s.color || CHART_COLORS[i % CHART_COLORS.length];
      out.push({ k: 'rect', x: lx, y: top + fs * 0.2, w: fs * 0.9, h: fs * 0.9, r: fs * 0.2, fill: col });
      out.push({ k: 'text', x: lx + fs * 1.3, y: top + fs * 1, text: s.name, size: fs, color, font });
      lx += fs * 2.4 + approxW(s.name, fs);
    });
    top += fs * 2;
  }
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  const axisW = Math.max(...ticks.map((t) => approxW(fmtNum(t), fs * 0.85))) + fs * 0.6;
  const px = L + axisW, pw = Math.max(4, R - px), py = top + fs * 0.4, ph = Math.max(4, B - fs * 1.8 - py);
  const yOf = (v) => py + ph - ((v - lo) / (hi - lo)) * ph;
  const grid = el.gridColor || 'rgba(120,130,145,0.35)';
  ticks.forEach((t) => {
    out.push({ k: 'line', x1: px, y1: yOf(t), x2: px + pw, y2: yOf(t), stroke: grid, sw: Math.max(1, fs / 16) });
    out.push({ k: 'text', x: px - fs * 0.4, y: yOf(t) + fs * 0.3, text: fmtNum(t), size: fs * 0.85, color, font, anchor: 'end' });
  });
  const n = Math.max(1, labels.length);
  const gw = pw / n;
  labels.forEach((l, i) => {
    out.push({ k: 'text', x: px + gw * i + gw / 2, y: py + ph + fs * 1.3, text: fitText(l, gw * 0.95, fs * 0.9), size: fs * 0.9, color, font, anchor: 'middle' });
  });
  if (type === 'bar') {
    const bw = (gw * 0.72) / Math.max(1, series.length);
    series.forEach((s, si) => {
      const col = s.color || CHART_COLORS[si % CHART_COLORS.length];
      s.values.slice(0, n).forEach((v, i) => {
        const x = px + gw * i + gw * 0.14 + bw * si;
        const y0 = yOf(0), y1 = yOf(v);
        out.push({ k: 'rect', x: x + bw * 0.06, y: Math.min(y0, y1), w: bw * 0.88, h: Math.max(0.5, Math.abs(y1 - y0)), fill: col, r: Math.min(bw * 0.2, fs * 0.3) });
        if (c.values) out.push({ k: 'text', x: x + bw / 2, y: Math.min(y0, y1) - fs * 0.3, text: fmtNum(v), size: fs * 0.8, color, font, anchor: 'middle' });
      });
    });
  } else {
    series.forEach((s, si) => {
      const col = s.color || CHART_COLORS[si % CHART_COLORS.length];
      const pts = s.values.slice(0, n).map((v, i) => [px + gw * i + gw / 2, yOf(v)]);
      if (!pts.length) return;
      const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
      if (type === 'area') out.push({ k: 'path', d: `${line}L${pts[pts.length - 1][0]} ${yOf(Math.max(lo, 0))}L${pts[0][0]} ${yOf(Math.max(lo, 0))}Z`, fill: col, opacity: 0.25 });
      out.push({ k: 'path', d: line, stroke: col, sw: Math.max(1.5, fs * 0.2) });
      out.push({ k: 'path', d: pts.map(([x, y]) => dot(x, y, Math.max(1.5, fs * 0.28))).join(''), fill: col });
      if (c.values) s.values.slice(0, n).forEach((v, i) => out.push({ k: 'text', x: pts[i][0], y: pts[i][1] - fs * 0.6, text: fmtNum(v), size: fs * 0.8, color, font, anchor: 'middle' }));
    });
  }
  return out;
}

/** The drawing pieces for a chart, table or QR code element. */
export function blockShapes(el) {
  try {
    if (el.type === 'qr') return qrShapes(el);
    if (el.type === 'table') return tableShapes(el);
    if (el.type === 'chart') return chartShapes(el);
  } catch {
    // Bad data from an import: draw nothing rather than break the page.
  }
  return [];
}

// ---------- new elements ----------
const base = (o) => ({ id: Math.random().toString(36).slice(2, 10), rotation: 0, opacity: 1, locked: false, hidden: false, ...o });

export function chartEl(type = 'bar', o) {
  return base({
    type: 'chart', x: 0, y: 0, w: 640, h: 420, color: '#16181d', fontFamily: 'Inter',
    chart: {
      type, title: '', legend: true, values: type === 'pie' || type === 'donut',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      series: [{ name: 'Sales', color: CHART_COLORS[0], values: [12, 19, 9, 24, 17] }, ...(type === 'pie' || type === 'donut' ? [] : [{ name: 'Costs', color: CHART_COLORS[1], values: [8, 11, 7, 13, 10] }])],
    },
    ...o,
  });
}

export function tableEl(o) {
  return base({
    type: 'table', x: 0, y: 0, w: 720, h: 260, fontFamily: 'Inter', color: '#16181d', header: true,
    headerBg: '#1f9d5a', headerColor: '#ffffff', cellBg: '#ffffff', stripe: '#f4f5f7', border: '#dfe2e7', align: 'left', radius: 0,
    rows: [['Item', 'Qty', 'Price'], ['Coffee', '2', '$6'], ['Bagel', '1', '$3'], ['Juice', '3', '$9']],
    ...o,
  });
}

export function qrEl(o) {
  return base({ type: 'qr', x: 0, y: 0, w: 300, h: 300, text: 'https://jaceo.vercel.app', color: '#000000', bg: '#ffffff', radius: 0, ...o });
}
