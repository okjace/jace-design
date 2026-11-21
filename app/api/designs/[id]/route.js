import { handler, json, requireUser, getUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { canEdit, cleanPerms, loadDesign, shareDefaults } from '@/lib/access';
import { normalizeDesign } from '@/lib/design';
import { sanitizeDesign } from '@/lib/sanitize';
import { snapshotVersion } from '@/lib/versions';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const ver = await one('SELECT updated_at::text AS v FROM designs WHERE id = $1', [id]);
  return json({ version: ver?.v || null, design: { id: design.id, title: design.title, data: design.data, visibility: design.visibility, is_template: design.is_template, category: design.category, owner_username: design.owner_username,
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
  // Move to a folder (or out of one with null).
  if (role === 'owner' && 'folder_id' in body) {
    const fid = body.folder_id ? String(body.folder_id) : null;
    if (fid && !(await one('SELECT 1 AS x FROM folders WHERE id = $1 AND owner_id = $2', [fid, user.id]))) return json({ error: 'No such folder' }, 400);
    vals.push(fid); sets.push(`folder_id = $${vals.length}`);
  }
  if (!sets.length) return json({ ok: true });
  // Only real edits (content or title) count as a new version; thumbnails and sharing settings don't.
  const edit = !!body.design || typeof body.title === 'string';
  let where = 'id = $1';
  if (edit && typeof body.expected === 'string' && body.expected) {
    // Someone else (or another tab) saved since this editor loaded: don't overwrite their work silently.
    // (Compared to the millisecond, so tiny differences in how the time is written never count.)
    vals.push(body.expected);
    where += ` AND ABS(EXTRACT(EPOCH FROM (updated_at - $${vals.length}::timestamptz))) < 0.001`;
  }
  // Remember who saved (and from which open editor), so a save can tell "someone else" from "me, a moment ago".
  const client = typeof body.client === 'string' ? body.client.replace(/[^\w-]/g, '').slice(0, 40) : '';
  if (edit) {
    vals.push(user.id); sets.push(`saved_by = $${vals.length}`);
    vals.push(client); sets.push(`saved_client = $${vals.length}`);
  }
  if (body.design) await snapshotVersion(id, user.id);
  const rows = await q(
    `UPDATE designs SET ${sets.join(', ')}${edit ? ', updated_at = NOW()' : ''} WHERE ${where} RETURNING updated_at::text AS v`,
    vals
  );
  if (!rows.length) {
    const cur = await one('SELECT updated_at::text AS v, saved_by, saved_client FROM designs WHERE id = $1', [id]);
    return json({
      error: 'conflict', updated_at: cur?.v || null,
      same_client: !!client && cur?.saved_client === client, // this very editor saved it (a reply got lost)
      same_user: cur?.saved_by === user.id, // you, in another tab or window
    }, 409);
  }
  return json({ ok: true, updated_at: rows[0].v });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  await q('DELETE FROM designs WHERE id = $1', [id]);
  return json({ ok: true });
});
