'use client';
// Auto captions: turn speech into timed captions in the browser (Whisper, via transformers.js). Nothing is uploaded.
const TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
const MODEL = 'Xenova/whisper-base.en';

let asr = null;
async function recognizer(onStatus) {
  if (!asr) {
    asr = (async () => {
      const tf = await import(/* webpackIgnore: true */ TF);
      tf.env.allowLocalModels = false;
      return tf.pipeline('automatic-speech-recognition', MODEL, {
        progress_callback: (p) => { if (p.status === 'progress' && /onnx/.test(p.file || '')) onStatus?.(`Getting the caption maker ready… ${Math.round(p.progress || 0)}% (only the first time)`); },
      });
    })().catch((e) => { asr = null; throw e; });
  }
  return asr;
}

/** Audio file (URL) → mono 16 kHz samples, which is what the speech model reads. */
async function samples(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 16000, 16000);
  const audio = await ctx.decodeAudioData(buf);
  // Resample to 16 kHz mono.
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

/** Split long pieces into short captions (about 7 words), sharing out the time. */
function shorten(chunks, maxWords = 7) {
  const out = [];
  for (const c of chunks) {
    const [a, b] = c.timestamp;
    const words = c.text.trim().split(/\s+/).filter(Boolean);
    if (!words.length || a == null) continue;
    const end = b ?? a + words.length * 0.4;
    const parts = Math.ceil(words.length / maxWords);
    for (let i = 0; i < parts; i++) {
      const w = words.slice(i * maxWords, (i + 1) * maxWords);
      out.push({ start: a + ((end - a) * i) / parts, end: a + ((end - a) * (i + 1)) / parts, text: w.join(' ') });
    }
  }
  return out;
}

/** Captions for a recording: [{ start, end, text }] in seconds from the start of the recording. */
export async function makeCaptions(url, onStatus) {
  onStatus?.('Getting the caption maker ready…');
  const run = await recognizer(onStatus);
  onStatus?.('Listening to the voiceover…');
  const audio = await samples(url);
  onStatus?.('Writing captions…');
  const res = await run(audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
  return shorten(res.chunks || [{ timestamp: [0, audio.length / 16000], text: res.text || '' }]).map((c) => ({ ...c, start: Math.round(c.start * 100) / 100, end: Math.round(c.end * 100) / 100 }));
}

/** Draw the caption showing at time t (bottom or top of the frame). */
export function drawCaption(ctx, design, t) {
  const caps = design.captions;
  if (!caps?.length) return;
  const c = caps.find((x) => t >= x.start && t < x.end);
  if (!c || !c.text) return;
  const st = design.captionStyle || {};
  const W = design.width, H = design.height;
  const size = Math.round(Math.min(W, H) * (st.size || 0.05));
  ctx.save();
  ctx.font = `700 ${size}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Wrap to at most 80% of the width.
  const words = c.text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W * 0.8 && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const lh = size * 1.25;
  const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size;
  const boxH = lines.length * lh + size * 0.4;
  const y = st.position === 'top' ? H * 0.06 : H * 0.94 - boxH;
  if (st.bg !== false) {
    ctx.fillStyle = st.bgColor || 'rgba(0,0,0,0.65)';
    const x = W / 2 - boxW / 2, r = size * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + boxW, y, x + boxW, y + boxH, r); ctx.arcTo(x + boxW, y + boxH, x, y + boxH, r);
    ctx.arcTo(x, y + boxH, x, y, r); ctx.arcTo(x, y, x + boxW, y, r); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = st.color || '#ffffff';
  if (st.bg === false) { ctx.lineWidth = size * 0.12; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round'; }
  lines.forEach((l, i) => {
    const ly = y + size * 0.2 + lh * i + lh / 2;
    if (st.bg === false) ctx.strokeText(l, W / 2, ly);
    ctx.fillText(l, W / 2, ly);
  });
  ctx.restore();
}
