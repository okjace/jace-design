'use client';
// Built-in AI from the browser: is it on, and ask it (see app/api/ai/route.js).
import { useEffect, useState } from 'react';

let statusPromise = null;
export function aiStatus(refresh = false) {
  if (!statusPromise || refresh) statusPromise = fetch('/api/ai', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ available: false }));
  return statusPromise;
}

/** { available, left, limit } — available is false until the site owner adds a GROQ_API_KEY. */
export function useAiStatus() {
  const [s, setS] = useState({ available: false, loading: true });
  useEffect(() => { aiStatus().then((x) => setS({ ...x, loading: false })); }, []);
  return [s, (left) => setS((x) => ({ ...x, left }))];
}

/** Ask the built-in AI. onText(soFar) is called as the answer streams in. Returns { text, left }. */
export async function askAi(prompt, { system, onText, long } = {}) {
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system, long }) });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw Object.assign(new Error(d.error || 'The AI couldn’t answer just now.'), { left: d.left });
  }
  const left = Number(r.headers.get('X-AI-Left'));
  let text = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    onText?.(text);
  }
  text += dec.decode();
  if (!text.trim()) throw new Error('The AI gave an empty answer. Try again.');
  statusPromise = Promise.resolve({ available: true, left: Number.isFinite(left) ? left : undefined });
  return { text, left: Number.isFinite(left) ? left : undefined };
}
