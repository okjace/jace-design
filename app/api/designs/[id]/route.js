import { handler, json, requireUser, getUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { canEdit, cleanPerms, loadDesign, shareDefaults } from '@/lib/access';
import { normalizeDesign } from '@/lib/design';
import { sanitizeDesign } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  return json({ design: { id: design.id, title: design.title, data: design.data, visibility: design.visibility, is_template: design.is_template, category: design.category, owner_username: design.owner_username,
    ...(role === 'owner' ? { link_perms: design.link_perms, require_request: design.require_request, default_person_perms: shareDefaults(user).person_perms } : {}) }, role });
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
    const d = sanitizeDesign(normalizeDesign(body.design));
    vals.push(JSON.stringify(d)); sets.push(`data = $${vals.length}::text::jsonb`);
    vals.push(d.width); sets.push(`width = $${vals.length}`);
    vals.push(d.height); sets.push(`height = $${vals.length}`);
  }
  // A small preview image made in the browser (shown in lists instead of the whole design).
  if (typeof body.thumb === 'string' && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(body.thumb) && body.thumb.length < 400_000) {
    vals.push(body.thumb); sets.push(`thumb = $${vals.length}`);
  }
  if (typeof body.title === 'string') { vals.push(body.title.slice(0, 120) || 'Untitled design'); sets.push(`title = $${vals.length}`); }
  if (role === 'owner' && body.link_perms && typeof body.link_perms === 'object') { vals.push(JSON.stringify(cleanPerms(body.link_perms))); sets.push(`link_perms = $${vals.length}::text::jsonb`); }
  if (role === 'owner' && typeof body.require_request === 'boolean') { vals.push(body.require_request); sets.push(`require_request = $${vals.length}`); }
  if (role === 'owner' && typeof body.category === 'string') { vals.push(body.category.slice(0, 40)); sets.push(`category = $${vals.length}`); }
  if (role === 'owner' && typeof body.is_template === 'boolean') { vals.push(body.is_template); sets.push(`is_template = $${vals.length}`); }
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
