import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { inboxItems } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// GET /api/inbox → { items, unread }   ·   GET /api/inbox?count=1 → { unread }
export const GET = handler(async (request) => {
  const user = await requireUser();
  const c = await one('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [user.id]);
  if (new URL(request.url).searchParams.get('count')) return json({ unread: c.n });
  return json({ items: await inboxItems(user.id), unread: c.n });
});

// PATCH { ids: [...] | all: true, read: true|false }  ·  { id, action: 'accept' | 'decline' | 'delete' }
export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json();
  if (body.id && body.action) {
    const n = await one('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [String(body.id), user.id]);
    if (!n) return json({ error: 'Not found' }, 404);
    if (body.action === 'delete') {
      await q('DELETE FROM notifications WHERE id = $1', [n.id]);
    } else if (body.action === 'decline' && n.type === 'share' && n.design_id) {
      // Turning down an invite takes away the access it gave you.
      await q('DELETE FROM shares WHERE design_id = $1 AND user_id = $2', [n.design_id, user.id]);
      await q(`UPDATE notifications SET status = 'declined', read_at = COALESCE(read_at, NOW()) WHERE id = $1`, [n.id]);
    } else if (body.action === 'accept') {
      await q(`UPDATE notifications SET status = 'accepted', read_at = COALESCE(read_at, NOW()) WHERE id = $1`, [n.id]);
    }
  } else if (body.all) {
    await q(`UPDATE notifications SET read_at = ${body.read === false ? 'NULL' : 'NOW()'} WHERE user_id = $1`, [user.id]);
  } else if (Array.isArray(body.ids) && body.ids.length) {
    await q(
      `UPDATE notifications SET read_at = ${body.read === false ? 'NULL' : 'COALESCE(read_at, NOW())'} WHERE user_id = $1 AND id = ANY($2::text[])`,
      [user.id, body.ids.map(String).slice(0, 200)]
    );
  }
  const c = await one('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [user.id]);
  return json({ items: await inboxItems(user.id), unread: c.n });
});
