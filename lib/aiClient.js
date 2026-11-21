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

export async function askAi(prompt, { system } = {}) {
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, system }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'The AI couldn’t answer just now.'), { left: d.left });
  statusPromise = Promise.resolve({ available: true, left: d.left });
  return d;
}
