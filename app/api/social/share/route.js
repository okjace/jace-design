import { handler, json, requireUser, siteUrl } from '@/lib/auth';
import { loadDesign } from '@/lib/access';
import { jaceApi, socialToken } from '@/lib/social';

export const dynamic = 'force-dynamic';

// Send a design to Jace Social friends / group chats as a message from you.
// { design_id, message, friends: [userId], groups: [groupId] }
export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json();
  const { design, role } = await loadDesign(String(body.design_id || ''), user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const t = socialToken(user);
  if (!t.token) return json({ error: 'Connect Jace Social first.', reason: t.reason }, 401);
  const friends = (Array.isArray(body.friends) ? body.friends : []).map(String).filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 20);
  const groups = (Array.isArray(body.groups) ? body.groups : []).map(String).filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 10);
  if (!friends.length && !groups.length) return json({ error: 'Pick at least one friend or group.' }, 400);
  const link = `${await siteUrl()}/d/${design.id}`;
  const note = String(body.message || '').trim().slice(0, 1000);
  const text = `${note ? `${note}\n\n` : ''}🎨 ${design.title}\n${link}`;
  let sent = 0;
  const failed = [];
  for (const id of friends) {
    const r = await jaceApi(t.token, `/api/oauth/messages/dm/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ body: text }) });
    if (r.ok) sent++; else failed.push(r.data?.error_description || r.data?.error || `error ${r.status}`);
  }
  for (const id of groups) {
    const r = await jaceApi(t.token, `/api/oauth/messages/groups/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ body: text }) });
    if (r.ok) sent++; else failed.push(r.data?.error_description || r.data?.error || `error ${r.status}`);
  }
  if (!sent && failed.some((f) => /scope|token/i.test(f))) return json({ error: 'Connect Jace Social again.', reason: 'connect' }, 401);
  return json({ sent, failed: failed.length, error: failed[0] || null });
});
