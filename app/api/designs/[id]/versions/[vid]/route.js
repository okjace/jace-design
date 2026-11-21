import { handler, json, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { canEdit, loadDesign } from '@/lib/access';
import { getVersion, snapshotVersion } from '@/lib/versions';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id, vid } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return { error: json({ error: 'Not found' }, 404) };
  const version = await getVersion(id, vid);
  if (!version) return { error: json({ error: 'Not found' }, 404) };
  return { id, user, version };
}

// One version's content (for the preview).
export const GET = handler(async (_req, ctx) => {
  const r = await load(ctx.params);
  if (r.error) return r.error;
  return json({ version: r.version });
});

// Restore it. What's there now is kept as a version first, so a restore can be undone.
export const POST = handler(async (_req, ctx) => {
  const r = await load(ctx.params);
  if (r.error) return r.error;
  await snapshotVersion(r.id, r.user.id, { name: 'Before restoring an older version', force: true });
  const rows = await q(
    `UPDATE designs d SET data = v.data, title = CASE WHEN v.title <> '' THEN v.title ELSE d.title END, updated_at = NOW()
     FROM design_versions v WHERE d.id = $1 AND v.id = $2::bigint AND v.design_id = d.id RETURNING d.updated_at::text AS v`,
    [r.id, r.version.id]
  );
  return json({ ok: true, updated_at: rows[0]?.v || null });
});

// Rename (named versions) or delete one.
export const PUT = handler(async (request, ctx) => {
  const r = await load(ctx.params);
  if (r.error) return r.error;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80) || null;
  await q('UPDATE design_versions SET name = $3::text WHERE design_id = $1 AND id = $2::bigint', [r.id, r.version.id, name]);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const r = await load(ctx.params);
  if (r.error) return r.error;
  await q('DELETE FROM design_versions WHERE design_id = $1 AND id = $2::bigint', [r.id, r.version.id]);
  return json({ ok: true });
});
