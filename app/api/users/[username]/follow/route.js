import { after } from 'next/server';
import { handler, json, requireUser, siteUrl } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { emailUser } from '@/lib/jace';

export const POST = handler(async (_req, { params }) => {
  const { username } = await params;
  const user = await requireUser();
  const target = await one('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [decodeURIComponent(username)]);
  if (!target) return json({ error: 'Not found' }, 404);
  if (target.id === user.id) return json({ error: "You can't follow yourself" }, 400);
  const existing = await one('SELECT 1 AS x FROM follows WHERE follower_id = $1 AND following_id = $2', [user.id, target.id]);
  if (existing) {
    await q('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [user.id, target.id]);
  } else {
    await q('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, target.id]);
    const base = await siteUrl();
    after(() => emailUser(target.id, {
      subject: `${user.name || user.username} followed you`,
      heading: 'You have a new follower',
      message: `${user.name || user.username} (@${user.username}) is now following you on Jace Design.`,
      button_label: 'See their profile',
      button_url: `${base}/u/${encodeURIComponent(user.username)}`,
    }));
  }
  const c = await one('SELECT COUNT(*)::int AS n FROM follows WHERE following_id = $1', [target.id]);
  return json({ following: !existing, followers: c.n });
});
