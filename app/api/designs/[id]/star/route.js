import { handler, json, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadDesign } from '@/lib/access';

export const dynamic = 'force-dynamic';

// Star or unstar a design (shows under "Starred" on your home page).
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const b = await request.json().catch(() => ({}));
  if (b.on === false) await q('DELETE FROM stars WHERE user_id = $1 AND design_id = $2', [user.id, id]);
  else await q('INSERT INTO stars (user_id, design_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, id]);
  return json({ ok: true, on: b.on !== false });
});
