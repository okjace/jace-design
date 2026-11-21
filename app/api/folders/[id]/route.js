import { handler, json, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const PUT = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) return json({ error: 'Give the folder a name.' }, 400);
  await q('UPDATE folders SET name = $3 WHERE id = $1 AND owner_id = $2', [id, user.id, name]);
  return json({ ok: true });
});

// Deleting a folder keeps its designs (they go back to "All designs").
export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await q('UPDATE designs SET folder_id = NULL WHERE folder_id = $1 AND owner_id = $2', [id, user.id]);
  await q('DELETE FROM folders WHERE id = $1 AND owner_id = $2', [id, user.id]);
  return json({ ok: true });
});
