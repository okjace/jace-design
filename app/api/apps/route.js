import { getUser, handler, json, newId, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { cleanApp } from '@/lib/apps';

export const dynamic = 'force-dynamic';

const COLS = `a.id, a.name, a.description, a.icon, a.url, a.public, a.installs, a.created_at, a.owner_id, u.username, u.name AS owner_name`;

// scope=public (default): the app directory · scope=installed: apps you added or made · scope=mine: apps you made
export const GET = handler(async (request) => {
  const sp = new URL(request.url).searchParams;
  const scope = sp.get('scope') || 'public';
  const term = String(sp.get('q') || '').trim().slice(0, 60);
  const user = await getUser();
  let rows;
  if (scope === 'installed' || scope === 'mine') {
    if (!user) return json({ apps: [] });
    rows = await q(
      `SELECT ${COLS} FROM apps a JOIN users u ON u.id = a.owner_id
       WHERE a.owner_id = $1 ${scope === 'installed' ? 'OR EXISTS (SELECT 1 FROM app_installs i WHERE i.app_id = a.id AND i.user_id = $1)' : ''}
       ORDER BY a.name`, [user.id]);
  } else {
    rows = await q(
      `SELECT ${COLS}, ${user ? 'EXISTS (SELECT 1 FROM app_installs i WHERE i.app_id = a.id AND i.user_id = $2)' : 'FALSE'} AS installed
       FROM apps a JOIN users u ON u.id = a.owner_id
       WHERE a.public AND ($1 = '' OR a.name ILIKE '%' || $1 || '%' OR a.description ILIKE '%' || $1 || '%')
       ORDER BY a.installs DESC, a.created_at DESC LIMIT 200`, user ? [term, user.id] : [term]);
  }
  return json({ apps: rows.map((r) => ({ ...r, mine: user?.id === r.owner_id })) });
});

// Make an app.
export const POST = handler(async (request) => {
  const user = await requireUser();
  const c = cleanApp(await request.json().catch(() => ({})));
  if (c.error) return json({ error: c.error }, 400);
  const n = await one('SELECT COUNT(*)::int AS n FROM apps WHERE owner_id = $1', [user.id]);
  if (n.n >= 30) return json({ error: 'You can make up to 30 apps.' }, 400);
  const id = newId(12);
  const a = c.app;
  await q('INSERT INTO apps (id, owner_id, name, description, icon, url, public) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, user.id, a.name, a.description, a.icon, a.url, a.public]);
  return json({ ok: true, id });
});
