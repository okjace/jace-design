// Spreadsheets: cell addresses, a formula engine (=SUM(A1:A5) etc.), formatting and CSV.

export const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
export const colIndex = (name) => [...name.toUpperCase()].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
export const addr = (r, c) => `${colName(c)}${r + 1}`;
export function parseAddr(a) {
  const m = /^\$?([A-Z]{1,3})\$?(\d{1,5})$/i.exec(String(a).trim());
  return m ? { r: Number(m[2]) - 1, c: colIndex(m[1]) } : null;
}

export function blankSheet(name = 'Sheet 1') {
  return { id: Math.random().toString(36).slice(2, 10), name, rows: 100, cols: 26, cells: {}, colW: {} };
}

export function blankSpreadsheet(title = 'Spreadsheet') {
  return { kind: 'sheet', width: 1200, height: 800, sheets: [blankSheet()], pages: [], assets: [], title };
}

/** Clean a sheet loaded from anywhere (limits keep saves small and safe). */
export function normalizeSheets(sheets) {
  const list = Array.isArray(sheets) && sheets.length ? sheets.slice(0, 20) : [blankSheet()];
  return list.map((s, i) => {
    const cells = {};
    let n = 0;
    for (const [k, v] of Object.entries(s?.cells || {})) {
      if (n >= 20000 || !parseAddr(k) || !v || typeof v !== 'object') continue;
      const c = {};
      if (v.v != null && v.v !== '') c.v = String(v.v).slice(0, 2000);
      if (v.b) c.b = true;
      if (v.i) c.i = true;
      if (v.u) c.u = true;
      if (typeof v.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.color)) c.color = v.color;
      if (typeof v.bg === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.bg)) c.bg = v.bg;
      if (['left', 'center', 'right'].includes(v.align)) c.align = v.align;
      if (['number', 'currency', 'percent', 'date'].includes(v.fmt)) c.fmt = v.fmt;
      if (Object.keys(c).length) { cells[k.toUpperCase()] = c; n++; }
    }
    const colW = {};
    for (const [k, w] of Object.entries(s?.colW || {})) if (/^[A-Z]{1,3}$/.test(k)) colW[k] = Math.min(600, Math.max(30, Number(w) || 100));
    return {
      id: String(s?.id || Math.random().toString(36).slice(2, 10)).slice(0, 20),
      name: String(s?.name || `Sheet ${i + 1}`).slice(0, 40),
      rows: Math.min(2000, Math.max(10, Number(s?.rows) || 100)),
      cols: Math.min(100, Math.max(5, Number(s?.cols) || 26)),
      cells,
      colW,
    };
  });
}

// ---------------- formulas ----------------

class FormulaError extends Error {}
const ERR = (code) => { throw new FormulaError(code); };

function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '"') s += src[j++];
      if (src[j] !== '"') ERR('#ERR');
      t.push({ type: 'str', v: s }); i = j + 1; continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
    if (num) { t.push({ type: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const ref = /^\$?[A-Z]{1,3}\$?\d{1,5}(:\$?[A-Z]{1,3}\$?\d{1,5})?/i.exec(src.slice(i));
    const word = /^[A-Z_][A-Z0-9_.]*/i.exec(src.slice(i));
    if (ref && !(word && word[0].length > ref[0].length && src[i + word[0].length] === '(')) {
      t.push({ type: ref[1] ? 'range' : 'ref', v: ref[0].replace(/\$/g, '').toUpperCase() }); i += ref[0].length; continue;
    }
    if (word) { t.push({ type: 'word', v: word[0].toUpperCase() }); i += word[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '<>'].includes(two)) { t.push({ type: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>(),:%'.includes(ch)) { t.push({ type: 'op', v: ch }); i++; continue; }
    ERR('#ERR');
  }
  return t;
}

const toNum = (v) => {
  if (Array.isArray(v)) v = v[0];
  if (v === '' || v == null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  if (Number.isNaN(n)) ERR('#VALUE!');
  return n;
};
const flat = (args) => args.flat(Infinity);
const nums = (args) => flat(args).filter((v) => v !== '' && v != null && !Number.isNaN(Number(v)) && typeof v !== 'boolean').map(Number);

const FUNCS = {
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  AVERAGE: (a) => { const n = nums(a); if (!n.length) ERR('#DIV/0!'); return n.reduce((x, y) => x + y, 0) / n.length; },
  AVG: (a) => FUNCS.AVERAGE(a),
  MIN: (a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => nums(a).length,
  COUNTA: (a) => flat(a).filter((v) => v !== '' && v != null).length,
  IF: (a) => (toBool(a[0]) ? (a[1] ?? true) : (a[2] ?? false)),
  AND: (a) => flat(a).every(toBool),
  OR: (a) => flat(a).some(toBool),
  NOT: (a) => !toBool(a[0]),
  ROUND: (a) => { const p = 10 ** toNum(a[1] ?? 0); return Math.round(toNum(a[0]) * p) / p; },
  ABS: (a) => Math.abs(toNum(a[0])),
  SQRT: (a) => { const n = toNum(a[0]); if (n < 0) ERR('#NUM!'); return Math.sqrt(n); },
  POWER: (a) => toNum(a[0]) ** toNum(a[1]),
  MOD: (a) => { const d = toNum(a[1]); if (!d) ERR('#DIV/0!'); return toNum(a[0]) % d; },
  CONCAT: (a) => flat(a).map((v) => (v == null ? '' : String(v))).join(''),
  CONCATENATE: (a) => FUNCS.CONCAT(a),
  LEN: (a) => String(a[0] ?? '').length,
  UPPER: (a) => String(a[0] ?? '').toUpperCase(),
  LOWER: (a) => String(a[0] ?? '').toLowerCase(),
  TRIM: (a) => String(a[0] ?? '').trim(),
  TODAY: () => new Date().toISOString().slice(0, 10),
  NOW: () => new Date().toLocaleString(),
  PI: () => Math.PI,
};
const toBool = (v) => (Array.isArray(v) ? toBool(v[0]) : typeof v === 'string' ? v !== '' && v.toUpperCase() !== 'FALSE' : !!v);

/** Evaluate a whole sheet. Returns a function value(addr) with caching and cycle detection. */
export function makeEvaluator(sheet) {
  const cache = new Map();
  const visiting = new Set();

  function value(a) {
    a = a.toUpperCase();
    if (cache.has(a)) return cache.get(a);
    const raw = sheet.cells[a]?.v;
    let out;
    if (raw == null || raw === '') out = '';
    else if (String(raw).startsWith('=')) {
      if (visiting.has(a)) return '#CYCLE!';
      visiting.add(a);
      try { out = evaluate(String(raw).slice(1)); } catch (e) { out = e instanceof FormulaError ? e.message : '#ERR'; }
      visiting.delete(a);
      if (typeof out === 'number' && !Number.isFinite(out)) out = '#NUM!';
      if (Array.isArray(out)) out = out[0] ?? '';
    } else {
      const s = String(raw);
      out = s.trim() !== '' && !Number.isNaN(Number(s)) ? Number(s) : s;
    }
    cache.set(a, out);
    return out;
  }

  function range(r) {
    const [a, b] = r.split(':').map(parseAddr);
    if (!a || !b) ERR('#REF!');
    const out = [];
    for (let row = Math.min(a.r, b.r); row <= Math.max(a.r, b.r); row++)
      for (let col = Math.min(a.c, b.c); col <= Math.max(a.c, b.c); col++) {
        const v = value(addr(row, col));
        if (typeof v === 'string' && v.startsWith('#') && v.endsWith('!')) ERR(v);
        out.push(v);
      }
    return out;
  }

  function evaluate(src) {
    const t = tokenize(src);
    let i = 0;
    const peek = () => t[i];
    const eat = (v) => { if (t[i]?.v === v) { i++; return true; } return false; };
    const refVal = (a) => { const v = value(a); if (typeof v === 'string' && v.startsWith('#') && v.endsWith('!')) ERR(v); return v; };

    function primary() {
      const tok = t[i++];
      if (!tok) ERR('#ERR');
      if (tok.type === 'num' || tok.type === 'str') return tok.v;
      if (tok.type === 'ref') return refVal(tok.v);
      if (tok.type === 'range') return range(tok.v);
      if (tok.v === '(') { const v = comparison(); if (!eat(')')) ERR('#ERR'); return v; }
      if (tok.v === '-') return -toNum(unary());
      if (tok.v === '+') return toNum(unary());
      if (tok.type === 'word') {
        if (tok.v === 'TRUE') return true;
        if (tok.v === 'FALSE') return false;
        const fn = FUNCS[tok.v];
        if (!fn || !eat('(')) ERR('#NAME?');
        const args = [];
        if (!eat(')')) {
          do { args.push(comparison()); } while (eat(','));
          if (!eat(')')) ERR('#ERR');
        }
        return fn(args);
      }
      ERR('#ERR');
    }
    function unary() { let v = primary(); while (eat('%')) v = toNum(v) / 100; return v; }
    function power() { let v = unary(); while (eat('^')) v = toNum(v) ** toNum(unary()); return v; }
    function term() {
      let v = power();
      for (;;) {
        if (eat('*')) v = toNum(v) * toNum(power());
        else if (eat('/')) { const d = toNum(power()); if (d === 0) ERR('#DIV/0!'); v = toNum(v) / d; }
        else return v;
      }
    }
    function sum() {
      let v = term();
      for (;;) {
        if (eat('+')) v = toNum(v) + toNum(term());
        else if (eat('-')) v = toNum(v) - toNum(term());
        else return v;
      }
    }
    function concat() { let v = sum(); while (eat('&')) v = `${Array.isArray(v) ? v[0] : v ?? ''}${(() => { const x = sum(); return Array.isArray(x) ? x[0] : x ?? ''; })()}`; return v; }
    function comparison() {
      const a = concat();
      const op = peek();
      if (op && ['=', '<>', '<', '>', '<=', '>='].includes(op.v)) {
        i++;
        const b = concat();
        const x = typeof a === 'number' || typeof b === 'number' ? toNum(a) : String(a ?? '');
        const y = typeof a === 'number' || typeof b === 'number' ? toNum(b) : String(b ?? '');
        return { '=': x === y, '<>': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y }[op.v];
      }
      return a;
    }
    const v = comparison();
    if (i < t.length) ERR('#ERR');
    return v;
  }

  return value;
}

/** How a value is shown in a cell. */
export function display(v, fmt) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  if (typeof v === 'number') {
    if (fmt === 'currency') return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    if (fmt === 'percent') return `${(v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    if (fmt === 'number') return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10);
  }
  return v == null ? '' : String(v);
}

// ---------------- CSV ----------------

export function toCSV(sheet, valueOf) {
  let maxR = 0, maxC = 0;
  for (const k of Object.keys(sheet.cells)) { const p = parseAddr(k); if (p && sheet.cells[k].v != null) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); } }
  const esc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [];
  for (let r = 0; r <= maxR; r++) {
    const row = [];
    for (let c = 0; c <= maxC; c++) row.push(esc(display(valueOf(addr(r, c)), sheet.cells[addr(r, c)]?.fmt)));
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
