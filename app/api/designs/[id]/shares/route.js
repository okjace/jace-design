import { after } from 'next/server';
import { handler, json, requireUser, siteUrl } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { PRESETS, cleanPerms, loadDesign } from '@/lib/access';
import { emailUser } from '@/lib/jace';
import { notify } from '@/lib/notify';

async function list(id) {
  return q(`SELECT s.user_id, s.role, s.perms, u.username, u.name, u.picture FROM shares s JOIN users u ON u.id = s.user_id
            WHERE s.design_id = $1 ORDER BY s.created_at`, [id]);
}

const describe = (p) => [p.edit && 'edit', p.comment && 'comment on', p.view && 'view', p.download && 'download', p.print && 'print', p.remix && 'remix']
  .filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  return json({ shares: await list(id) });
});

// Share with a Jace user by username. role: view | comment | edit | custom (+ perms).
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  const body = await request.json();
  const username = String(body.username || '').trim().replace(/^@/, '');
  const shareRole = ['view', 'comment', 'edit'].includes(body.role) ? body.role : 'custom';
  const perms = cleanPerms(body.perms, PRESETS[shareRole] || PRESETS.view);
  const target = await one('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (!target) return json({ error: `@${username} hasn't used Jace Design yet. Ask them to sign in once, or send them the link.` }, 404);
  if (target.id === user.id) return json({ error: "That's you!" }, 400);
  const existed = await one('SELECT 1 AS x FROM shares WHERE design_id = $1 AND user_id = $2', [id, target.id]);
  await q(`INSERT INTO shares (design_id, user_id, role, perms) VALUES ($1, $2, $3, $4::text::jsonb)
           ON CONFLICT (design_id, user_id) DO UPDATE SET role = EXCLUDED.role, perms = EXCLUDED.perms`,
  [id, target.id, shareRole, JSON.stringify(perms)]);
  if (!existed || body.notify) {
    const base = await siteUrl();
    const note = String(body.message || '').trim().slice(0, 1000);
    await notify(target.id, { type: 'share', designId: id, actor: user, data: { perms, message: note } });
    after(() => emailUser(target.id, {
      subject: `${user.name || user.username} shared "${design.title}" with you`,
      heading: 'A design was shared with you',
      message: `${user.name || user.username} (@${user.username}) shared the design "${design.title}" with you on Jace Design. You can ${describe(perms)} it.${note ? `\n\nThey said:\n${note}` : ''}`,
      button_label: perms.edit ? 'Open in editor' : 'View design',
      button_url: perms.edit ? `${base}/design/${id}` : `${base}/d/${id}`,
    }));
  }
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
