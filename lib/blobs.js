'use client';
// Before a design is saved, big pictures, fonts and sounds kept inside it (data: links) are uploaded once to
// /api/blobs and replaced by short links. Saves become small and fast, and so do live updates between people.

const MIN = 24_000; // smaller things stay inside the design
const done = new Map(); // data URL -> /api/blobs/<hash> (this visit)

function toBytes(dataUrl) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!m[2]) return { mime, bytes: new TextEncoder().encode(decodeURIComponent(m[3])) };
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

const fixMime = (mime) => ({ 'font/woff': 'font/woff', 'application/font-woff': 'font/woff', 'application/x-font-woff': 'font/woff', 'font/opentype': 'font/otf', 'audio/mp3': 'audio/mpeg' }[mime] || mime);
const OK = /^(image\/(png|jpeg|webp|gif|svg\+xml)|font\/(ttf|otf|woff2?)|application\/(font-woff2?|x-font-ttf|x-font-otf|octet-stream|vnd\.ms-fontobject)|audio\/(mpeg|mp4|wav|ogg|webm))$/;

async function upload(dataUrl) {
  if (done.has(dataUrl)) return done.get(dataUrl);
  const parsed = toBytes(dataUrl);
  if (!parsed) return null;
  const mime = fixMime(parsed.mime);
  if (!OK.test(mime) || parsed.bytes.length > 4_400_000) return null; // keep it inside the design
  const digest = await crypto.subtle.digest('SHA-256', parsed.bytes);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const url = `/api/blobs/${hash}`;
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (!head?.ok) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': mime }, body: parsed.bytes });
    if (!r.ok) {
      if (r.status === 413 || r.status === 415) return null; // can't be stored separately: leave it in
      throw new Error(`Upload failed (${r.status})`);
    }
  }
  done.set(dataUrl, url);
  return url;
}

function collect(v, out) {
  if (typeof v === 'string') { if (v.length >= MIN && v.startsWith('data:')) out.add(v); return; }
  if (Array.isArray(v)) { v.forEach((x) => collect(x, out)); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) collect(v[k], out);
}

/** Swap strings using a map (returns the same object when nothing changes). */
export function swap(v, map) {
  if (!map.size) return v;
  if (typeof v === 'string') return map.get(v) ?? v;
  if (Array.isArray(v)) { let ch = false; const a = v.map((x) => { const y = swap(x, map); if (y !== x) ch = true; return y; }); return ch ? a : v; }
  if (v && typeof v === 'object') {
    let ch = false;
    const o = {};
    for (const k of Object.keys(v)) { const y = swap(v[k], map); if (y !== v[k]) ch = true; o[k] = y; }
    return ch ? o : v;
  }
  return v;
}

/** Upload big embedded files in `value` and return { value (with links), map (data URL -> link) }. */
export async function externalize(value) {
  const found = new Set();
  collect(value, found);
  const map = new Map();
  // A few at a time, so a design full of photos doesn't flood the connection.
  const list = [...found];
  for (let i = 0; i < list.length; i += 3) {
    await Promise.all(list.slice(i, i + 3).map(async (d) => { const url = await upload(d); if (url) map.set(d, url); }));
  }
  return { value: swap(value, map), map };
}
