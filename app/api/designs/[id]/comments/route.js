import { after } from 'next/server';
import { handler, json, newId, requireUser, siteUrl } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadDesign } from '@/lib/access';
import { emailUser } from '@/lib/jace';

export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const { body } = await request.json();
  const text = String(body || '').trim().slice(0, 1000);
  if (!text) return json({ error: 'Write something first' }, 400);
  const cid = newId();
  await q('INSERT INTO comments (id, design_id, user_id, body) VALUES ($1, $2, $3, $4)', [cid, id, user.id, text]);
  if (design.owner_id !== user.id) {
    const base = await siteUrl();
    after(() => emailUser(design.owner_id, {
      subject: `${user.name || user.username} commented on "${design.title}"`,
      heading: 'New comment on your design',
      message: `${user.name || user.username} (@${user.username}) commented on "${design.title}":\n\n${text}`,
      button_label: 'View comment',
      button_url: `${base}/d/${id}#comments`,
    }));
  }
  return json({ id: cid }, 201);
});
