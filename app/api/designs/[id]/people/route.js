import crypto from 'node:crypto';
import { handler, json, newId, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { PRESETS, cleanPerms, loadDesign, presetName } from '@/lib/access';

export const dynamic = 'force-dynamic';

const NONE = { view: false, comment: false, download: false, print: false, remix: false, edit: false };

// Guests are identified to the owner by a fingerprint of their private guest id, never the id itself.
const gkey = (token) => `g:${crypto.createHash('sha256').update(`guest:${token}`).digest('base64url').slice(0, 22)}`;

// Everyone who can open this design or has opened it: people added by username, guests you approved,
// and anyone (signed in or not) who came in through the link. Owner only.
async function people(design) {
  const id = design.id;
  const [shares, grants, visitors] = await Promise.all([
    q(`SELECT s.user_id, s.role, s.perms, s.created_at, u.username, u.name, u.picture
       FROM shares s JOIN users u ON u.id = s.user_id WHERE s.design_id = $1`, [id]),
    q(`SELECT DISTINCT ON (COALESCE(r.user_id, r.guest_token)) r.user_id, r.guest_token, r.guest_name, r.status, r.perms, r.created_at,
              u.username, u.name, u.picture
       FROM access_requests r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.design_id = $1 AND r.status IN ('approved', 'blocked', 'revoked')
       ORDER BY COALESCE(r.user_id, r.guest_token), r.created_at DESC`, [id]),
    q(`SELECT v.visitor_key, v.user_id, v.guest_token, v.guest_name, v.visits, v.first_seen, v.last_seen, u.username, u.name, u.picture
       FROM design_visitors v LEFT JOIN users u ON u.id = v.user_id WHERE v.design_id = $1
       ORDER BY v.last_seen DESC LIMIT 500`, [id]),
  ]);
  const linkOpen = (design.visibility === 'public' || design.visibility === 'link') && !design.require_request;
  const linkPerms = cleanPerms(design.link_perms, PRESETS.comment);
  const map = new Map();
  const get = (key, base) => {
    if (!map.has(key)) map.set(key, { key, perms: null, status: 'link', visits: 0, last_seen: null, ...base });
    return map.get(key);
  };
  for (const v of visitors) {
    const p = get(v.user_id ? `u:${v.user_id}` : gkey(v.guest_token), v.user_id
      ? { kind: 'user', user_id: v.user_id, username: v.username, name: v.name || v.username, picture: v.picture }
      : { kind: 'guest', guest_token: v.guest_token, name: v.guest_name || 'Guest' });
    p.visits = v.visits; p.last_seen = v.last_seen;
  }
  for (const g of grants) {
    const key = g.user_id ? `u:${g.user_id}` : gkey(g.guest_token);
    if (g.status === 'revoked') continue; // removed or reset: only listed if they've visited
    const p = get(key, g.user_id
      ? { kind: 'user', user_id: g.user_id, username: g.username, name: g.name || g.username, picture: g.picture }
      : { kind: 'guest', guest_token: g.guest_token, name: g.guest_name || 'Guest' });
    if (g.status === 'approved') { p.perms = cleanPerms(g.perms, linkPerms); p.status = 'approved'; }
    if (g.status === 'blocked') { p.perms = NONE; p.status = 'blocked'; }
  }
  for (const s of shares) {
    const p = get(`u:${s.user_id}`, { kind: 'user', user_id: s.user_id, username: s.username, name: s.name || s.username, picture: s.picture });
    p.perms = cleanPerms(s.perms, PRESETS[s.role] || PRESETS.view);
    p.status = p.perms.view ? 'added' : 'blocked';
  }
  const list = [...map.values()].map((p) => ({
    ...p,
    guest_token: undefined, // never send guests' tokens to the browser; `key` identifies them
    effective: p.perms || (linkOpen ? linkPerms : NONE),
    custom: !!p.perms,
  }));
  const order = { added: 0, approved: 1, link: 2, blocked: 3 };
  list.sort((a, b) => (order[a.status] - order[b.status]) || String(b.last_seen || '').localeCompare(String(a.last_seen || '')));
  return { people: list, link_open: linkOpen, link_perms: linkPerms };
}

async function ownerOnly(params) {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || role !== 'owner') throw Object.assign(new Error('Not found'), { status: 404 });
  return { user, design };
}

export const GET = handler(async (_req, { params }) => {
  const { design } = await ownerOnly(params);
  return json(await people(design));
});

// { key: 'u:<userId>' | 'g:<guestKey>', perms } to set exactly what they can do,
// { key, action: 'block' } to shut them out, or { key, action: 'reset' } to go back to the link settings.
export const PATCH = handler(async (request, { params }) => {
  const { design } = await ownerOnly(params);
  const id = design.id;
  const body = await request.json();
  const key = String(body.key || '');
  // 'remove' = take away their own access and drop them from the list.
  const removing = body.action === 'remove';
  const action = body.action === 'block' ? 'block' : body.action === 'reset' || removing ? 'reset' : 'set';
  const perms = action === 'block' ? NONE : cleanPerms(body.perms, PRESETS.view);

  if (key.startsWith('u:')) {
    const userId = key.slice(2);
    if (!(await one('SELECT 1 AS x FROM users WHERE id = $1', [userId]))) return json({ error: 'Not found' }, 404);
    if (action === 'reset') {
      await q('DELETE FROM shares WHERE design_id = $1 AND user_id = $2', [id, userId]);
      await q(`INSERT INTO access_requests (id, design_id, user_id, status) VALUES ($1, $2, $3, 'revoked')`, [newId(), id, userId]);
      if (removing) await q('DELETE FROM design_visitors WHERE design_id = $1 AND user_id = $2', [id, userId]);
    } else {
      await q(`INSERT INTO shares (design_id, user_id, role, perms) VALUES ($1, $2, $3, $4::text::jsonb)
               ON CONFLICT (design_id, user_id) DO UPDATE SET role = EXCLUDED.role, perms = EXCLUDED.perms`,
      [id, userId, action === 'block' ? 'custom' : presetName(perms), JSON.stringify(perms)]);
    }
  } else if (key.startsWith('g:')) {
    // Find which of this design's guests the fingerprint belongs to.
    const guests = await q(
      `SELECT guest_token, guest_name FROM design_visitors WHERE design_id = $1 AND guest_token IS NOT NULL
       UNION ALL SELECT guest_token, guest_name FROM access_requests WHERE design_id = $1 AND guest_token IS NOT NULL`, [id]);
    const known = guests.find((g) => gkey(g.guest_token) === key);
    if (!known) return json({ error: 'Not found' }, 404);
    const token = known.guest_token;
    const status = action === 'block' ? 'blocked' : action === 'reset' ? 'revoked' : 'approved';
    await q(`INSERT INTO access_requests (id, design_id, guest_token, guest_name, status, perms) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb)`,
      [newId(), id, token, known.guest_name, status, action === 'set' ? JSON.stringify(perms) : null]);
    if (removing) await q('DELETE FROM design_visitors WHERE design_id = $1 AND guest_token = $2', [id, token]);
  } else {
    return json({ error: 'Unknown person' }, 400);
  }
  return json(await people(design));
});
