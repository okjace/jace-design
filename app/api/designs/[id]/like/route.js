import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { loadDesign } from '@/lib/access';

export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const existing = await one('SELECT 1 AS x FROM likes WHERE design_id = $1 AND user_id = $2', [id, user.id]);
  if (existing) await q('DELETE FROM likes WHERE design_id = $1 AND user_id = $2', [id, user.id]);
  else await q('INSERT INTO likes (design_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, user.id]);
  const c = await one('SELECT COUNT(*)::int AS n FROM likes WHERE design_id = $1', [id]);
  return json({ liked: !existing, likes: c.n });
});
