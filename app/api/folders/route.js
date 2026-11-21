import { handler, json, newId, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Your folders, with how many designs are in each.
export const GET = handler(async () => {
  const user = await requireUser();
  const folders = await q(
    `SELECT f.id, f.name, (SELECT COUNT(*)::int FROM designs d WHERE d.folder_id = f.id AND d.owner_id = $1) AS count
     FROM folders f WHERE f.owner_id = $1 ORDER BY LOWER(f.name)`, [user.id]);
  return json({ folders });
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) return json({ error: 'Give the folder a name.' }, 400);
  const n = await q('SELECT COUNT(*)::int AS n FROM folders WHERE owner_id = $1', [user.id]);
  if (n[0].n >= 100) return json({ error: 'You have too many folders.' }, 400);
  const id = newId(12);
  await q('INSERT INTO folders (id, owner_id, name) VALUES ($1, $2, $3)', [id, user.id, name]);
  return json({ id, name, count: 0 });
});
