import { handler, json, requireUser } from '@/lib/auth';
import { canEdit, loadDesign } from '@/lib/access';
import { listVersions, snapshotVersion } from '@/lib/versions';

export const dynamic = 'force-dynamic';

// Version history for people who can edit the design.
export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  return json({ versions: await listVersions(id) });
});

// Save the design as it is now as a named version.
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80) || 'Saved version';
  const vid = await snapshotVersion(id, user.id, { name, force: true });
  if (!vid) return json({ error: 'Could not save the version.' }, 500);
  return json({ ok: true, id: String(vid) });
});
