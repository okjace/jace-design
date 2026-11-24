import { handler, json, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// AI pictures from a description, using Pollinations (free, no account or key). Asked from our server so
// the picture service never sees who you are; only the description and size are sent.
export const GET = handler(async (request) => {
  await requireUser();
  const sp = new URL(request.url).searchParams;
  const prompt = String(sp.get('prompt') || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (prompt.length < 2) return json({ error: 'Describe the picture you want.' }, 400);
  const clamp = (v, d) => Math.max(256, Math.min(1536, Math.round(Number(v) || d)));
  const w = clamp(sp.get('w'), 1024), h = clamp(sp.get('h'), 1024);
  const seed = Math.floor(Number(sp.get('seed')) || Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&private=true&safe=true`;
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(110_000) });
  } catch {
    return json({ error: 'The picture took too long. Try again.' }, 504);
  }
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) return json({ error: r.status === 429 ? 'The free picture service is busy. Wait a moment and try again.' : 'Couldn’t make that picture. Try again or change the description.' }, 502);
  return new Response(new Uint8Array(await r.arrayBuffer()), { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store' } });
});
