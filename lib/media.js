'use client';
// Upload big files (video, audio) in 3 MB pieces, and read what we need from them in the browser.
import { MAX_FILE, PART_SIZE } from './media-limits';

const fixMime = (f) => {
  const t = (f.type || '').split(';')[0].trim();
  if (t) return t === 'audio/mp3' ? 'audio/mpeg' : t === 'audio/x-m4a' ? 'audio/mp4' : t;
  const ext = (f.name || '').split('.').pop().toLowerCase();
  return { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac' }[ext] || '';
};

/** Upload a File/Blob. onProgress(0..1). Returns the URL it plays from. */
export async function uploadMedia(file, { name, onProgress } = {}) {
  const mime = fixMime(file);
  if (file.size > MAX_FILE) throw new Error(`That file is too big. Files can be up to ${Math.round(MAX_FILE / 1048576)} MB.`);
  const r = await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name || file.name || 'Recording', mime, size: file.size }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not start the upload.');
  const parts = Math.ceil(file.size / PART_SIZE);
  for (let i = 0; i < parts; i++) {
    const body = file.slice(i * PART_SIZE, Math.min(file.size, (i + 1) * PART_SIZE));
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      try {
        const pr = await fetch(`/api/media/${d.id}?part=${i}`, { method: 'PUT', body });
        ok = pr.ok;
        if (!ok && pr.status < 500) throw new Error((await pr.json().catch(() => ({}))).error || 'Upload failed.');
      } catch (e) {
        if (attempt === 3 || /wrong size|Bad part|Not found/.test(e.message)) throw e;
      }
      if (!ok) await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
    if (!ok) throw new Error('Upload failed. Check your connection and try again.');
    onProgress?.((i + 1) / parts);
  }
  const f = await fetch(`/api/media/${d.id}`, { method: 'POST' });
  if (!f.ok) throw new Error((await f.json().catch(() => ({}))).error || 'Could not finish the upload.');
  return d.url;
}

/** Size, length and a still picture (poster) of a video file, read locally before uploading. */
export function videoInfo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    const done = (x) => { URL.revokeObjectURL(url); x instanceof Error ? reject(x) : resolve(x); };
    v.onerror = () => done(new Error("That video can't be played in this browser. Try an MP4 (H.264) or WebM file."));
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); };
    v.onseeked = () => {
      const w = v.videoWidth || 640, h = v.videoHeight || 360;
      const s = Math.min(1, 720 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      done({ width: w, height: h, duration: v.duration || 0, poster: c.toDataURL('image/jpeg', 0.8) });
    };
    v.src = url;
  });
}

export function audioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(a.duration || 0); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    a.src = url;
  });
}
