import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { PART_SIZE } from '@/lib/media-limits';

export const dynamic = 'force-dynamic';

const okId = (id) => /^[A-Za-z0-9_-]{8,40}$/.test(id);

async function mine(id, user) {
  if (!okId(id)) return null;
  return one('SELECT id, owner_id, size, parts, ready, mime FROM media WHERE id = $1 AND owner_id = $2', [id, user.id]);
}

// One 3 MB piece of an upload.
export const PUT = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const m = await mine(id, user);
  if (!m) return json({ error: 'Not found' }, 404);
  if (m.ready) return json({ error: 'Already finished' }, 409);
  const part = Number(new URL(request.url).searchParams.get('part'));
  if (!Number.isInteger(part) || part < 0 || part >= m.parts) return json({ error: 'Bad part' }, 400);
  const buf = Buffer.from(await request.arrayBuffer());
  const want = part === m.parts - 1 ? Number(m.size) - part * PART_SIZE : PART_SIZE;
  if (buf.length !== want) return json({ error: 'That piece is the wrong size.' }, 400);
  await q(`INSERT INTO media_parts (media_id, idx, data) VALUES ($1, $2, $3) ON CONFLICT (media_id, idx) DO UPDATE SET data = EXCLUDED.data`, [id, part, buf]);
  return json({ ok: true });
});

// Finish an upload (all pieces sent).
export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const m = await mine(id, user);
  if (!m) return json({ error: 'Not found' }, 404);
  const got = await one('SELECT COUNT(*)::int AS n, COALESCE(SUM(octet_length(data)), 0)::bigint AS bytes FROM media_parts WHERE media_id = $1', [id]);
  if (got.n !== m.parts || Number(got.bytes) !== Number(m.size)) return json({ error: 'Some of the file is missing. Try uploading it again.' }, 400);
  await q('UPDATE media SET ready = TRUE WHERE id = $1', [id]);
  return json({ ok: true, url: `/api/media/${id}` });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  if (!okId(id)) return json({ error: 'Not found' }, 404);
  await q('DELETE FROM media WHERE id = $1 AND owner_id = $2', [id, user.id]);
  return json({ ok: true });
});

// Play it. Anyone with the (unguessable) link can, like images inside a shared design.
// Video and audio players ask for byte ranges; each answer is at most one 3 MB piece so it stays small.
export async function GET(request, { params }) {
  const { id } = await params;
  if (!okId(id)) return new Response('Not found', { status: 404 });
  const m = await one('SELECT size, parts, mime FROM media WHERE id = $1 AND ready', [id]);
  if (!m) return new Response('Not found', { status: 404 });
  const size = Number(m.size);
  const head = { 'Content-Type': m.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' };
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  const piece = async (i) => Buffer.from((await one('SELECT data FROM media_parts WHERE media_id = $1 AND idx = $2', [id, i]))?.data || []);

  if (!range) {
    // Whole file: stream it piece by piece.
    let next = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        if (next >= m.parts) { controller.close(); return; }
        controller.enqueue(new Uint8Array(await piece(next)));
        next += 1;
      },
    });
    return new Response(stream, { headers: { ...head, 'Content-Length': String(size) } });
  }
  let start = range[1] === '' ? Math.max(0, size - Number(range[2] || 0)) : Number(range[1]);
  let end = range[1] === '' ? size - 1 : range[2] === '' ? size - 1 : Math.min(size - 1, Number(range[2]));
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...head, 'Content-Range': `bytes */${size}` } });
  const i = Math.floor(start / PART_SIZE);
  end = Math.min(end, (i + 1) * PART_SIZE - 1); // stay inside one piece
  const buf = await piece(i);
  const body = buf.subarray(start - i * PART_SIZE, end - i * PART_SIZE + 1);
  return new Response(new Uint8Array(body), { status: 206, headers: { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(body.length) } });
}
