import { handler, json, requireUser, getUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { canEdit, loadDesign } from '@/lib/access';
import { normalizeDesign } from '@/lib/design';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  return json({ design: { id: design.id, title: design.title, data: design.data, visibility: design.visibility, owner_username: design.owner_username }, role });
});

export const PUT = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  const body = await request.json();
  const sets = [];
  const vals = [id];
  if (body.design) {
    const d = normalizeDesign(body.design);
    vals.push(JSON.stringify(d)); sets.push(`data = $${vals.length}::jsonb`);
    vals.push(d.width); sets.push(`width = $${vals.length}`);
    vals.push(d.height); sets.push(`height = $${vals.length}`);
  }
  if (typeof body.title === 'string') { vals.push(body.title.slice(0, 120) || 'Untitled design'); sets.push(`title = $${vals.length}`); }
  if (role === 'owner' && ['private', 'link', 'public'].includes(body.visibility)) { vals.push(body.visibility); sets.push(`visibility = $${vals.length}`); }
  if (!sets.length) return json({ ok: true });
  await q(`UPDATE designs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, vals);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  await q('DELETE FROM designs WHERE id = $1', [id]);
  return json({ ok: true });
});
