import { after } from 'next/server';
import { getUser, handler, json, newId, requireUser, siteUrl } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { PRESETS, cleanPerms, getGuest, loadDesign } from '@/lib/access';
import { emailUser } from '@/lib/jace';

export const dynamic = 'force-dynamic';

async function list(id) {
  return q(
    `SELECT r.id, r.user_id, r.guest_name, r.message, r.status, r.created_at, u.username, u.name, u.picture
     FROM access_requests r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.design_id = $1 AND r.status = 'pending' ORDER BY r.created_at DESC LIMIT 100`,
    [id]
  );
}

// Owner: see pending requests.
export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  return json({ requests: await list(id) });
});

// Anyone: ask for access.
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  if (!user && !guest?.name) return json({ error: 'Tell us your name first.' }, 400);
  const { design, role } = await loadDesign(id, user, { guest });
  if (!design) return json({ error: 'Not found' }, 404);
  if (role) return json({ ok: true, already: true });
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || '').trim().slice(0, 500);
  const pending = user
    ? await one(`SELECT id FROM access_requests WHERE design_id = $1 AND user_id = $2 AND status = 'pending'`, [id, user.id])
    : await one(`SELECT id FROM access_requests WHERE design_id = $1 AND guest_token = $2 AND status = 'pending'`, [id, guest.token]);
  if (pending) return json({ ok: true, pending: true });
  await q(
    `INSERT INTO access_requests (id, design_id, user_id, guest_token, guest_name, message) VALUES ($1, $2, $3, $4, $5, $6)`,
    [newId(), id, user?.id || null, user ? null : guest.token, user ? null : guest.name, message]
  );
  const who = user ? `${user.name || user.username} (@${user.username})` : `${guest.name} (no Jace account)`;
  const base = await siteUrl();
  after(() => emailUser(design.owner_id, {
    subject: `${user ? user.name || user.username : guest.name} asked to see "${design.title}"`,
    heading: 'Someone asked for access',
    message: `${who} asked for access to your design "${design.title}".${message ? `\n\nThey said:\n${message}` : ''}\n\nOpen the design and press Share to allow or deny it.`,
    button_label: 'Review request',
    button_url: `${base}/design/${id}?share=1`,
  }));
  return json({ ok: true, pending: true }, 201);
});

// Owner: approve or deny. { request_id, action: 'approve'|'deny', role, perms }
export const PATCH = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') return json({ error: 'Not found' }, 404);
  const body = await request.json();
  const r = await one('SELECT * FROM access_requests WHERE id = $1 AND design_id = $2', [String(body.request_id), id]);
  if (!r) return json({ error: 'Request not found' }, 404);
  const base = await siteUrl();
  if (body.action === 'deny') {
    await q(`UPDATE access_requests SET status = 'denied' WHERE id = $1`, [r.id]);
  } else {
    const presetRole = ['view', 'comment', 'edit'].includes(body.role) ? body.role : 'custom';
    const perms = cleanPerms(body.perms, PRESETS[presetRole] || PRESETS.view);
    if (r.user_id) {
      await q(`INSERT INTO shares (design_id, user_id, role, perms) VALUES ($1, $2, $3, $4::text::jsonb)
               ON CONFLICT (design_id, user_id) DO UPDATE SET role = EXCLUDED.role, perms = EXCLUDED.perms`,
      [id, r.user_id, presetRole, JSON.stringify(perms)]);
    }
    await q(`UPDATE access_requests SET status = 'approved', perms = $2::text::jsonb WHERE id = $1`, [r.id, JSON.stringify(perms)]);
    if (r.user_id) {
      after(() => emailUser(r.user_id, {
        subject: `You can now open "${design.title}"`,
        heading: 'Access granted',
        message: `${user.name || user.username} gave you access to "${design.title}" on Jace Design.`,
        button_label: perms.edit ? 'Open in editor' : 'View design',
        button_url: perms.edit ? `${base}/design/${id}` : `${base}/d/${id}`,
      }));
    }
  }
  return json({ requests: await list(id) });
});
