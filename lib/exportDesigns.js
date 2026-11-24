'use client';
// Export designs as Jace Design files (.jdesign.json) — one file, or a .zip of many — that can be imported
// again on any Jace Design site (Create → Import). Pictures and fonts are put back inside the files.
import { downloadBlob, safeName } from './export';

const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

async function inline(value, cache) {
  if (typeof value === 'string') {
    if (!/^\/api\/blobs\/[a-f0-9]{64}$/.test(value)) return value;
    if (!cache.has(value)) {
      cache.set(value, fetch(value).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? blobToDataUrl(b) : value)).catch(() => value));
    }
    return cache.get(value);
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => inline(v, cache)));
  if (value && typeof value === 'object') {
    const out = {};
    await Promise.all(Object.keys(value).map(async (k) => { out[k] = await inline(value[k], cache); }));
    return out;
  }
  return value;
}

/** ids: design ids. onProgress(done, total). */
export async function exportDesigns(ids, { onProgress } = {}) {
  const cache = new Map();
  const files = [];
  for (let n = 0; n < ids.length; n++) {
    onProgress?.(n, ids.length);
    const r = await fetch(`/api/designs/${ids[n]}`, { cache: 'no-store' });
    if (!r.ok) continue;
    const { design } = await r.json();
    const data = await inline(design.data, cache);
    files.push({ name: `${safeName(design.title)}.jdesign.json`, text: JSON.stringify({ format: 'jace-design', version: 1, title: design.title, design: data }) });
  }
  onProgress?.(ids.length, ids.length);
  if (!files.length) throw new Error('Nothing could be exported.');
  if (files.length === 1) {
    downloadBlob(new Blob([files[0].text], { type: 'application/json' }), files[0].name);
    return;
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set();
  for (const f of files) {
    let name = f.name;
    for (let k = 2; used.has(name); k++) name = f.name.replace(/\.jdesign\.json$/, ` (${k}).jdesign.json`);
    used.add(name);
    zip.file(name, f.text);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `jace-designs-${new Date().toISOString().slice(0, 10)}.zip`);
}
