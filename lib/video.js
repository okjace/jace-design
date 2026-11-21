'use client';
// Video designs: scenes (pages) with durations and transitions, elements with entrance animations.
// One renderer draws any moment in time onto a canvas; it powers both the player and the video export.
import { textLines, videoLength } from './design';
import { downloadBlob, drawPage, ensureFonts, preloadImages, safeName } from './export';

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); // ease-out cubic
const easeBack = (t) => { const c = 1.7; const x = Math.min(1, Math.max(0, t)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const TRANSITION_TIME = 0.6;

/** Which scene is showing at time t, and how far into it. */
export function sceneAt(design, t) {
  let start = 0;
  for (let i = 0; i < design.pages.length; i++) {
    const d = Number(design.pages[i].duration) || 3;
    if (t < start + d || i === design.pages.length - 1) return { index: i, local: Math.max(0, t - start), start, duration: d };
    start += d;
  }
  return { index: 0, local: 0, start: 0, duration: 3 };
}

/** How an element looks `local` seconds into its scene (entrance animation). */
export function animState(el, local, W, H) {
  const a = el.anim || {};
  const type = a.type || 'none';
  if (type === 'none') return { alpha: 1 };
  const delay = Number(a.delay) || 0;
  const dur = Math.max(0.1, Number(a.duration) || 0.7);
  const p = (local - delay) / dur;
  if (p <= 0) return { alpha: 0 };
  const e = ease(p);
  const dist = Math.min(W, H) * 0.12;
  switch (type) {
    case 'fade': return { alpha: e };
    case 'slide-up': return { alpha: e, dy: (1 - e) * dist };
    case 'slide-down': return { alpha: e, dy: -(1 - e) * dist };
    case 'slide-left': return { alpha: e, dx: (1 - e) * dist * 1.6 };
    case 'slide-right': return { alpha: e, dx: -(1 - e) * dist * 1.6 };
    case 'zoom': return { alpha: e, scale: 0.6 + 0.4 * e };
    case 'pop': return { alpha: Math.min(1, p * 3), scale: Math.max(0.01, easeBack(p)) };
    case 'drop': return { alpha: Math.min(1, p * 2.5), dy: -(1 - easeBack(p)) * dist * 1.5 };
    case 'spin': return { alpha: e, rotate: (1 - e) * -180, scale: 0.5 + 0.5 * e };
    case 'typewriter': {
      if (el.type !== 'text') return { alpha: e };
      const lines = textLines(el);
      const total = lines.reduce((n, l) => n + [...l].length, 0);
      let left = Math.floor(total * Math.min(1, p));
      const shown = lines.map((l) => { const chars = [...l]; const take = Math.max(0, Math.min(chars.length, left)); left -= take; return chars.slice(0, take).join(''); });
      return { alpha: 1, lines: shown };
    }
    default: return { alpha: 1 };
  }
}

/** Draw the frame at time t (seconds) onto ctx (already scaled to design units). */
export async function drawFrame(ctx, design, t) {
  const W = design.width, H = design.height;
  const s = sceneAt(design, t);
  const page = design.pages[s.index];
  const prev = s.index > 0 ? design.pages[s.index - 1] : null;
  const tr = page.transition || 'fade';
  const inT = prev && tr !== 'none' ? Math.min(1, s.local / TRANSITION_TIME) : 1;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (inT < 1) {
    // Draw the previous scene as it ends, then the new one coming in.
    const prevLen = Number(prev.duration) || 3;
    ctx.save();
    if (tr === 'slide') ctx.translate(-W * ease(inT), 0);
    if (tr === 'push') ctx.translate(0, -H * ease(inT));
    await drawPage(ctx, design, prev, (el) => animState(el, prevLen, W, H));
    ctx.restore();
  }
  ctx.save();
  if (inT < 1 && tr === 'wipe') { ctx.beginPath(); ctx.rect(0, 0, W * ease(inT), H); ctx.clip(); }
  // Fades multiply every element's own transparency (each element sets its own alpha when drawn).
  let sceneAlpha = 1;
  if (inT < 1) {
    const e = ease(inT);
    if (tr === 'fade') sceneAlpha = e;
    if (tr === 'slide') ctx.translate(W * (1 - e), 0);
    if (tr === 'push') ctx.translate(0, H * (1 - e));
    if (tr === 'zoom') { sceneAlpha = e; ctx.translate(W / 2, H / 2); ctx.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); ctx.translate(-W / 2, -H / 2); }
  }
  ctx.globalAlpha = sceneAlpha;
  await drawPage(ctx, design, page, (el) => {
    const st = animState(el, s.local, W, H);
    return { ...st, alpha: (st.alpha ?? 1) * sceneAlpha };
  });
  ctx.restore();
  ctx.restore();
}

export { videoLength };

/**
 * Record the video in real time from a canvas (MP4 where the browser supports it, otherwise WebM).
 * onProgress(seconds, total). Returns a Blob.
 */
export async function recordVideo(design, { scale = 1, fps = 30, onProgress, signal } = {}) {
  await ensureFonts(design);
  await preloadImages(design);
  const W = Math.round(design.width * scale), H = Math.round(design.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = W - (W % 2); canvas.height = H - (H % 2); // encoders like even sizes
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(fps);

  let audioEl = null, audioCtx = null;
  if (design.audio?.src) {
    audioCtx = new AudioContext();
    audioEl = new Audio(design.audio.src);
    audioEl.loop = true;
    const srcNode = audioCtx.createMediaElementSource(audioEl);
    const gain = audioCtx.createGain();
    gain.gain.value = design.audio.volume ?? 0.8;
    const dest = audioCtx.createMediaStreamDestination();
    srcNode.connect(gain).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }

  const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = types.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if (!mimeType) throw new Error("This browser can't record video. Try Chrome, Edge or the Jace Design desktop app.");
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.min(12_000_000, W * H * fps * 0.15) });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });

  const total = videoLength(design);
  ctx.save();
  ctx.scale(canvas.width / design.width, canvas.height / design.height);
  await drawFrame(ctx, design, 0);
  rec.start(250);
  if (audioEl) { await audioCtx.resume(); audioEl.currentTime = 0; audioEl.play().catch(() => {}); }
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = async () => {
      if (signal?.aborted) { resolve(); return; }
      const t = (performance.now() - t0) / 1000;
      if (t >= total) { resolve(); return; }
      await drawFrame(ctx, design, t);
      onProgress?.(t, total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await drawFrame(ctx, design, total - 0.001);
  ctx.restore();
  rec.stop();
  await stopped;
  if (audioEl) { audioEl.pause(); audioCtx.close().catch(() => {}); }
  stream.getTracks().forEach((t) => t.stop());
  if (signal?.aborted) throw new Error('Cancelled');
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}

export async function exportVideo(design, title, opts) {
  const blob = await recordVideo(design, opts);
  downloadBlob(blob, `${safeName(title)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
}
