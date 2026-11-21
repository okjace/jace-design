import { getUser, handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const okId = (id) => /^[A-Za-z0-9_-]{8,40}$/.test(id);

// The full photo. Public photos are for everyone; private ones only for their owner.
export async function GET(request, { params }) {
  const { id } = await params;
  if (!okId(id)) return new Response('Not found', { status: 404 });
  const p = await one('SELECT owner_id, mime, public FROM photos WHERE id = $1', [id]);
  if (!p) return new Response('Not found', { status: 404 });
  if (!p.public) {
    const user = await getUser();
    if (user?.id !== p.owner_id) return new Response('Not found', { status: 404 });
  }
  const d = await one('SELECT data FROM photo_data WHERE photo_id = $1', [id]);
  if (!d) return new Response('Not found', { status: 404 });
  // Count it as "used" when it's taken into a design.
  if (new URL(request.url).searchParams.get('use') === '1') q('UPDATE photos SET uses = uses + 1 WHERE id = $1', [id]).catch(() => {});
  return new Response(new Uint8Array(Buffer.from(d.data)), {
    headers: {
      'Content-Type': p.mime,
      'Cache-Control': p.public ? 'public, max-age=86400' : 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// Change the title, tags, or whether it's in the community library.
export const PUT = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const b = await request.json().catch(() => ({}));
  const sets = [];
  const vals = [id, user.id];
  if (typeof b.title === 'string') { vals.push(b.title.replace(/\s+/g, ' ').trim().slice(0, 100)); sets.push(`title = $${vals.length}`); }
  if (typeof b.tags === 'string') { vals.push(b.tags.replace(/\s+/g, ' ').trim().slice(0, 200)); sets.push(`tags = $${vals.length}`); }
  if (typeof b.public === 'boolean') { vals.push(b.public); sets.push(`public = $${vals.length}`); }
  if (sets.length) await q(`UPDATE photos SET ${sets.join(', ')} WHERE id = $1 AND owner_id = $2`, vals);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await q('DELETE FROM photos WHERE id = $1 AND owner_id = $2', [id, user.id]);
  return json({ ok: true });
});
