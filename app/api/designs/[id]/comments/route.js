import { after } from 'next/server';
import { getUser, handler, json, newId, siteUrl } from '@/lib/auth';
import { q } from '@/lib/db';
import { getGuest, loadDesign } from '@/lib/access';
import { emailUser } from '@/lib/jace';

export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  if (!user && !guest?.name) return json({ error: 'Sign in with Jace or enter your name to comment.' }, 401);
  const { design, role, perms } = await loadDesign(id, user, { guest });
  if (!design || !role) return json({ error: 'Not found' }, 404);
  if (!perms.comment) return json({ error: "Comments aren't allowed on this design." }, 403);
  const { body } = await request.json();
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) return json({ error: 'Write something first' }, 400);
  const cid = newId();
  await q('INSERT INTO comments (id, design_id, user_id, guest_name, body) VALUES ($1, $2, $3, $4, $5)',
    [cid, id, user?.id || null, user ? null : guest.name, text]);
  if (!user || design.owner_id !== user.id) {
    const base = await siteUrl();
    const who = user ? `${user.name || user.username} (@${user.username})` : `${guest.name} (guest)`;
    after(() => emailUser(design.owner_id, {
      subject: `${user ? user.name || user.username : guest.name} commented on "${design.title}"`,
      heading: 'New comment on your design',
      message: `${who} commented on "${design.title}":\n\n${text}`,
      button_label: 'View comment',
      button_url: `${base}/d/${id}#comments`,
    }));
  }
  return json({ id: cid }, 201);
});
