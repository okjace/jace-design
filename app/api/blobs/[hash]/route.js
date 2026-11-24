import crypto from 'node:crypto';
import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Pictures, fonts and short sounds that designs use, stored once and named by the SHA-256 of their bytes.
// The name can't be guessed without having the file, and the same file is only ever stored once.
const okHash = (h) => /^[a-f0-9]{64}$/.test(h);
const MIME = /^(image\/(png|jpeg|webp|gif|svg\+xml)|font\/(ttf|otf|woff2?)|application\/(font-woff2?|x-font-ttf|x-font-otf|octet-stream|vnd\.ms-fontobject)|audio\/(mpeg|mp4|wav|ogg|webm))$/;
const MAX = 4_400_000; // stays under the 4.5 MB upload limit

const headers = (mime, size) => ({
  'Content-Type': mime === 'image/svg+xml' ? mime : mime,
  'Content-Length': String(size),
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  // SVGs are shown as pictures only, never run as pages.
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
});

export async function GET(_req, { params }) {
  const { hash } = await params;
  if (!okHash(hash)) return new Response('Not found', { status: 404 });
  const b = await one('SELECT mime, size, data FROM blobs WHERE hash = $1', [hash]);
  if (!b) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(Buffer.from(b.data)), { headers: headers(b.mime, b.size) });
}

// "Is it already stored?" (so the browser can skip uploading it again).
export async function HEAD(_req, { params }) {
  const { hash } = await params;
  if (!okHash(hash)) return new Response(null, { status: 404 });
  const b = await one('SELECT mime, size FROM blobs WHERE hash = $1', [hash]);
  return new Response(null, { status: b ? 200 : 404, headers: b ? headers(b.mime, b.size) : {} });
}

export const PUT = handler(async (request, { params }) => {
  const { hash } = await params;
  const user = await requireUser();
  if (!okHash(hash)) return json({ error: 'Bad name' }, 400);
  const mime = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!MIME.test(mime)) return json({ error: 'That kind of file can’t be stored.' }, 415);
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length || buf.length > MAX) return json({ error: 'That file is too big.' }, 413);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== hash) return json({ error: 'The file doesn’t match its name.' }, 400);
  await q('INSERT INTO blobs (hash, owner_id, mime, size, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (hash) DO NOTHING', [hash, user.id, mime, buf.length, buf]);
  return json({ ok: true, url: `/api/blobs/${hash}` });
});
