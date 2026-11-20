import { after } from 'next/server';
import { handler, json, requireUser, siteUrl } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { loadDesign } from '@/lib/access';
import { emailUser } from '@/lib/jace';

async function list(id) {
  return q(`SELECT s.user_id, s.role, u.username, u.name, u.picture FROM shares s JOIN users u ON u.id = s.user_id
            WHERE s.design_id = $1 ORDER BY s.created_at`, [id]);
}

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  return json({ shares: await list(id) });
});

// Share with a Jace user by username (they must have signed in to Jace Design once).
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  const body = await request.json();
  const username = String(body.username || '').trim().replace(/^@/, '');
  const shareRole = body.role === 'edit' ? 'edit' : 'view';
  const target = await one('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (!target) return json({ error: `@${username} hasn't used Jace Design yet. Ask them to sign in once, or send them the link.` }, 404);
  if (target.id === user.id) return json({ error: "That's you!" }, 400);
  await q(`INSERT INTO shares (design_id, user_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (design_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [id, target.id, shareRole]);
  const base = await siteUrl();
  const note = String(body.message || '').trim().slice(0, 1000);
  after(() => emailUser(target.id, {
    subject: `${user.name || user.username} shared "${design.title}" with you`,
    heading: 'A design was shared with you',
    message: `${user.name || user.username} (@${user.username}) shared the design "${design.title}" with you on Jace Design. You can ${shareRole === 'edit' ? 'view and edit' : 'view'} it.${note ? `\n\nThey said:\n${note}` : ''}`,
    button_label: shareRole === 'edit' ? 'Open in editor' : 'View design',
    button_url: shareRole === 'edit' ? `${base}/design/${id}` : `${base}/d/${id}`,
  }));
  return json({ shares: await list(id) });
});

export const DELETE = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  const { user_id } = await request.json();
  await q('DELETE FROM shares WHERE design_id = $1 AND user_id = $2', [id, user_id]);
  return json({ shares: await list(id) });
});
