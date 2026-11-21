import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { cleanApp } from '@/lib/apps';

export const dynamic = 'force-dynamic';

// Add or remove an app from your Apps tab: { installed: true|false }. The maker can also edit or delete it.
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const app = await one('SELECT id, owner_id, public FROM apps WHERE id = $1', [id]);
  if (!app || (!app.public && app.owner_id !== user.id)) return json({ error: 'Not found' }, 404);
  const b = await request.json().catch(() => ({}));
  if (b.installed === false) {
    const r = await q('DELETE FROM app_installs WHERE user_id = $1 AND app_id = $2 RETURNING app_id', [user.id, id]);
    if (r.length) await q('UPDATE apps SET installs = GREATEST(0, installs - 1) WHERE id = $1', [id]);
  } else {
    const r = await q('INSERT INTO app_installs (user_id, app_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING app_id', [user.id, id]);
    if (r.length) await q('UPDATE apps SET installs = installs + 1 WHERE id = $1', [id]);
  }
  return json({ ok: true, installed: b.installed !== false });
});

export const PUT = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const c = cleanApp(await request.json().catch(() => ({})));
  if (c.error) return json({ error: c.error }, 400);
  const a = c.app;
  await q('UPDATE apps SET name = $3, description = $4, icon = $5, url = $6, public = $7 WHERE id = $1 AND owner_id = $2',
    [id, user.id, a.name, a.description, a.icon, a.url, a.public]);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await q('DELETE FROM apps WHERE id = $1 AND owner_id = $2', [id, user.id]);
  return json({ ok: true });
});
