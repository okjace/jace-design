'use client';
// Video designs: scenes (pages) with durations and transitions, elements with entrance animations.
// One renderer draws any moment in time onto a canvas; it powers both the player and the video export.
import { textLines, videoLength } from './design';
import { downloadBlob, drawPage, ensureFonts, preloadImages, safeName } from './export';

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); // ease-out cubic
const easeBack = (t) => { const c = 1.7; const x = Math.min(1, Math.max(0, t)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const TRANSITION_TIME = 0.6;

// ---------- video clips ----------
// Each clip is drawn from a hidden <video>. While playing, the <video> plays (with its sound) and is nudged
// back in sync when it drifts; when paused or scrubbing it is seeked to the exact moment instead.
const shared = new Map();
function clipFor(videos, el) {
  const key = `${el.id}|${el.src}`;
  let v = videos.get(key);
  if (!v) {
    v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.preload = 'auto';
    v.src = el.src;
    videos.set(key, v);
  }
  return v;
}
function syncClip(el, local, opts) {
  if (!el.src || typeof document === 'undefined') return null;
  const videos = opts.videos || shared;
  const v = clipFor(videos, el);
  opts.used?.add(v);
  const start = Number(el.trimStart) || 0;
  const len = Math.max(0.1, (Number(el.trimEnd) || Number(el.duration) || v.duration || 5) - start);
  const over = local >= len && !el.loop;
  const want = start + (el.loop ? local % len : Math.min(local, len - 0.04));
  v.volume = Math.min(1, Math.max(0, el.volume ?? 1));
  v.muted = !!el.muted || !opts.playing || !!opts.silent;
  if (opts.playing && !over) {
    if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = want;
    if (v.paused) v.play().catch(() => {});
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
  }
  return v;
}
/** Pause every clip (when a player stops or closes). */
export function stopClips(videos = shared) {
  for (const v of videos.values()) { try { v.pause(); } catch {} }
}

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

/**
 * Draw the frame at time t (seconds) onto ctx (already scaled to design units).
 * opts.playing: clips play with sound (else they're seeked silently); opts.videos: a Map of clip players.
 */
export async function drawFrame(ctx, design, t, opts = {}) {
  opts = { ...opts, used: new Set() };
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
    await drawPage(ctx, design, prev, (el) => {
      const st = animState(el, prevLen, W, H);
      return el.type === 'video' ? { ...st, frame: syncClip(el, prevLen + s.local, opts) } : st;
    });
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
    const out = { ...st, alpha: (st.alpha ?? 1) * sceneAlpha };
    if (el.type === 'video') out.frame = syncClip(el, Math.max(0, s.local - (Number(el.anim?.delay) || 0)), opts);
    return out;
  });
  ctx.restore();
  ctx.restore();
  // Clips from other scenes stop.
  for (const v of (opts.videos || shared).values()) if (!opts.used.has(v) && !v.paused) v.pause();
}

export { videoLength };

/** Music and voiceover for live playback: play(t) to start at t, tick(t) every frame, pause() to stop. */
export function makeSoundtrack(design) {
  const music = design.audio?.src ? new Audio(design.audio.src) : null;
  const voice = design.voiceover?.src ? new Audio(design.voiceover.src) : null;
  if (music) { music.loop = true; music.volume = design.audio.volume ?? 0.8; }
  if (voice) voice.volume = Math.min(1, design.voiceover.volume ?? 1);
  const vStart = Number(design.voiceover?.start) || 0;
  return {
    play(t) {
      if (music) { try { music.currentTime = music.duration ? t % music.duration : t; } catch {} music.play().catch(() => {}); }
      this.tick(t);
    },
    tick(t) {
      if (!voice) return;
      const local = t - vStart;
      const len = voice.duration || Number(design.voiceover.duration) || Infinity;
      if (local >= 0 && local < len) {
        if (voice.paused) { try { voice.currentTime = local; } catch {} voice.play().catch(() => {}); }
        else if (Math.abs(voice.currentTime - local) > 0.35) voice.currentTime = local;
      } else if (!voice.paused) voice.pause();
    },
    pause() { music?.pause(); voice?.pause(); },
  };
}

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

  // Sound: music, voiceover and the clips' own sound are mixed into the recording.
  let audioEl = null, voiceEl = null, audioCtx = null, dest = null;
  const videos = new Map();
  const clips = design.pages.flatMap((p) => p.elements.filter((e) => e.type === 'video' && e.src));
  if (design.audio?.src || design.voiceover?.src || clips.some((c) => !c.muted)) {
    audioCtx = new AudioContext();
    dest = audioCtx.createMediaStreamDestination();
    const wire = (el, vol) => { const g = audioCtx.createGain(); g.gain.value = vol; audioCtx.createMediaElementSource(el).connect(g).connect(dest); };
    if (design.audio?.src) { audioEl = new Audio(); audioEl.crossOrigin = 'anonymous'; audioEl.src = design.audio.src; audioEl.loop = true; wire(audioEl, design.audio.volume ?? 0.8); }
    if (design.voiceover?.src) { voiceEl = new Audio(); voiceEl.crossOrigin = 'anonymous'; voiceEl.src = design.voiceover.src; wire(voiceEl, design.voiceover.volume ?? 1); }
    for (const c of clips) if (!c.muted) wire(clipFor(videos, c), 1);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  await Promise.all(clips.map((c) => new Promise((r) => { const v = clipFor(videos, c); if (v.readyState >= 2) r(); else { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 8000); } })));

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
  await drawFrame(ctx, design, 0, { videos });
  rec.start(250);
  if (audioCtx) await audioCtx.resume();
  if (audioEl) { audioEl.currentTime = 0; audioEl.play().catch(() => {}); }
  let voiceStarted = false;
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = async () => {
      if (signal?.aborted) { resolve(); return; }
      const t = (performance.now() - t0) / 1000;
      if (t >= total) { resolve(); return; }
      if (voiceEl && !voiceStarted && t >= (Number(design.voiceover.start) || 0)) { voiceStarted = true; voiceEl.currentTime = t - (Number(design.voiceover.start) || 0); voiceEl.play().catch(() => {}); }
      await drawFrame(ctx, design, t, { playing: true, videos });
      onProgress?.(t, total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await drawFrame(ctx, design, total - 0.001, { videos });
  ctx.restore();
  rec.stop();
  await stopped;
  audioEl?.pause(); voiceEl?.pause(); stopClips(videos);
  audioCtx?.close().catch(() => {});
  stream.getTracks().forEach((t) => t.stop());
  if (signal?.aborted) throw new Error('Cancelled');
  return new Blob(chunks, { type: mimeType.split(';')[0] });
}

export async function exportVideo(design, title, opts) {
  const blob = await recordVideo(design, opts);
  downloadBlob(blob, `${safeName(title)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
}
