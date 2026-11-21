import { handler, json, newId, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { MAX_FILE, MAX_TOTAL, MEDIA_TYPES, PART_SIZE } from '@/lib/media-limits';

export const dynamic = 'force-dynamic';

// Start an upload of a video or audio file. The browser then sends it in 3 MB pieces (PUT /api/media/[id]?part=n).
export const POST = handler(async (request) => {
  const user = await requireUser();
  const b = await request.json().catch(() => ({}));
  const mime = String(b.mime || '').toLowerCase();
  const size = Math.floor(Number(b.size) || 0);
  if (!MEDIA_TYPES.test(mime)) return json({ error: 'That kind of file is not supported. Use MP4 or WebM video, or MP3, M4A, WAV or OGG audio.' }, 400);
  if (size <= 0) return json({ error: 'That file is empty.' }, 400);
  if (size > MAX_FILE) return json({ error: `That file is too big. Files can be up to ${Math.round(MAX_FILE / 1048576)} MB.` }, 413);
  // Forget unfinished uploads older than a day.
  await q(`DELETE FROM media WHERE owner_id = $1 AND NOT ready AND created_at < NOW() - INTERVAL '1 day'`, [user.id]);
  const used = await one('SELECT COALESCE(SUM(size), 0)::bigint AS n FROM media WHERE owner_id = $1', [user.id]);
  if (Number(used?.n || 0) + size > MAX_TOTAL) {
    return json({ error: `You've used your ${Math.round(MAX_TOTAL / 1048576)} MB of video and audio space. Delete some uploads to add more.` }, 413);
  }
  const id = newId(20);
  await q('INSERT INTO media (id, owner_id, name, mime, size, parts) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, user.id, String(b.name || '').slice(0, 120), mime, size, Math.ceil(size / PART_SIZE)]);
  return json({ id, url: `/api/media/${id}`, partSize: PART_SIZE });
});

// Your uploads (newest first) and how much space they use.
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await q(`SELECT id, name, mime, size, created_at FROM media WHERE owner_id = $1 AND ready ORDER BY created_at DESC LIMIT 200`, [user.id]);
  const used = rows.reduce((n, r) => n + Number(r.size), 0);
  return json({ media: rows.map((r) => ({ ...r, size: Number(r.size), url: `/api/media/${r.id}` })), used, limit: MAX_TOTAL });
});
