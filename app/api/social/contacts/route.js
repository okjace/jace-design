import { handler, json, requireUser } from '@/lib/auth';
import { jaceApi, socialToken } from '@/lib/social';

export const dynamic = 'force-dynamic';

// Your Jace Social friends (people you've messaged) and group chats.
export const GET = handler(async () => {
  const user = await requireUser();
  const t = socialToken(user);
  if (!t.token) return json({ connected: false, reason: t.reason });
  const r = await jaceApi(t.token, '/api/oauth/messages');
  if (r.status === 401 || r.status === 403) return json({ connected: false, reason: 'connect' });
  if (!r.ok) return json({ connected: true, error: 'Jace Social is not answering right now.', friends: [], groups: [] });
  const friends = (r.data.direct || []).map((d) => ({ id: String(d.user_id), username: d.username || '' })).filter((f) => f.id);
  const groups = (r.data.groups || []).map((g) => ({ id: String(g.id), name: g.name || 'Group chat', members: (g.member_ids || []).length }));
  return json({ connected: true, friends, groups });
});
