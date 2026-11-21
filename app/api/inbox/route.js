import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { clearInvite, inboxItems, unreadCount } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// GET /api/inbox → { items, unread }   ·   GET /api/inbox?count=1 → { unread }
export const GET = handler(async (request) => {
  const user = await requireUser();
  const unread = await unreadCount(user.id);
  if (new URL(request.url).searchParams.get('count')) return json({ unread });
  return json({ items: await inboxItems(user.id), unread });
});

// PATCH { ids: [...] | all: true, read: true|false }  ·  { id, action: 'accept' | 'decline' | 'delete' }
export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json();
  if (body.id && body.action) {
    const n = await one('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [String(body.id), user.id]);
    if (n) {
      if (n.type === 'share' && n.design_id && (body.action === 'accept' || body.action === 'decline')) {
        // Turning down an invite takes away the access it gave you. Either way the invite is done.
        if (body.action === 'decline') await q('DELETE FROM shares WHERE design_id = $1 AND user_id = $2', [n.design_id, user.id]);
        await clearInvite(user.id, n.design_id);
      } else {
        await q('DELETE FROM notifications WHERE id = $1', [n.id]);
      }
    }
  } else if (body.all) {
    await q(`UPDATE notifications SET read_at = ${body.read === false ? 'NULL' : 'NOW()'} WHERE user_id = $1`, [user.id]);
  } else if (Array.isArray(body.ids) && body.ids.length) {
    await q(
      `UPDATE notifications SET read_at = ${body.read === false ? 'NULL' : 'COALESCE(read_at, NOW())'} WHERE user_id = $1 AND id = ANY($2::text[])`,
      [user.id, body.ids.map(String).slice(0, 200)]
    );
  }
  return json({ items: await inboxItems(user.id), unread: await unreadCount(user.id) });
});
