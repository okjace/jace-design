import 'server-only';
import { cookies } from 'next/headers';
import { one } from './db';
import { sign, verify } from './auth';

// Everything someone can be allowed to do with a design.
export const PERM_KEYS = ['view', 'comment', 'download', 'print', 'remix', 'edit'];
export const PRESETS = {
  view: { view: true, comment: false, download: true, print: true, remix: true, edit: false },
  comment: { view: true, comment: true, download: true, print: true, remix: true, edit: false },
  edit: { view: true, comment: true, download: true, print: true, remix: true, edit: true },
};
const ALL = { view: true, comment: true, download: true, print: true, remix: true, edit: true };
const NONE = { view: false, comment: false, download: false, print: false, remix: false, edit: false };

export function cleanPerms(p, fallback = PRESETS.view) {
  if (!p || typeof p !== 'object') return { ...fallback };
  const out = {};
  for (const k of PERM_KEYS) out[k] = typeof p[k] === 'boolean' ? p[k] : !!fallback[k];
  if (out.edit) out.view = true;
  if (out.comment) out.view = true;
  return out;
}

/** A person's default sharing settings for new designs (with safe fallbacks). */
export function shareDefaults(user) {
  const d = user?.share_defaults && typeof user.share_defaults === 'object' ? user.share_defaults : {};
  return {
    visibility: ['private', 'link', 'public'].includes(d.visibility) ? d.visibility : 'private',
    link_perms: cleanPerms(d.link_perms, PRESETS.comment),
    require_request: !!d.require_request,
    person_perms: cleanPerms(d.person_perms, PRESETS.view),
  };
}

export function presetName(perms) {
  for (const [name, p] of Object.entries(PRESETS)) if (PERM_KEYS.every((k) => !!p[k] === !!perms?.[k])) return name;
  return 'custom';
}

// ---- Visitors without a Jace account must give a name ----
export const GUEST_COOKIE = 'jd_guest';

export async function getGuest() {
  const store = await cookies();
  const g = verify(store.get(GUEST_COOKIE)?.value);
  return g?.t ? { token: g.t, name: g.n || '' } : null;
}

export function guestCookie(token, name) {
  return {
    name: GUEST_COOKIE,
    value: sign({ t: token, n: name }),
    options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 },
  };
}

/**
 * Load a design and work out what this visitor may do.
 * role: 'owner' | 'edit' | 'view' | null   (null = no access)
 * perms: { view, comment, download, print, remix, edit }
 * request: status of their access request when they have no access ('none' | 'pending' | 'denied')
 * needsName: a visitor without a Jace account who hasn't told us their name yet
 */
export async function loadDesign(id, user, { guest } = {}) {
  const d = await one(
    `SELECT d.*, u.username AS owner_username, u.name AS owner_name, u.picture AS owner_picture
     FROM designs d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
    [id]
  );
  if (!d) return { design: null, role: null, perms: NONE };
  if (guest === undefined && !user) guest = await getGuest().catch(() => null);

  let perms = null;
  if (user && d.owner_id === user.id) {
    return { design: d, role: 'owner', perms: ALL, request: null, needsName: false };
  }
  if (user) {
    const s = await one('SELECT role, perms FROM shares WHERE design_id = $1 AND user_id = $2', [id, user.id]);
    if (s) perms = cleanPerms(s.perms, PRESETS[s.role] || PRESETS.view);
  }
  if (!perms && (d.visibility === 'public' || d.visibility === 'link') && !d.require_request) {
    perms = cleanPerms(d.link_perms, PRESETS.comment);
  }
  let request = null;
  if (!perms) {
    // Approved access requests (for people who had to ask).
    const r = user
      ? await one(`SELECT status, perms FROM access_requests WHERE design_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`, [id, user.id])
      : guest?.token
        ? await one(`SELECT status, perms FROM access_requests WHERE design_id = $1 AND guest_token = $2 ORDER BY created_at DESC LIMIT 1`, [id, guest.token])
        : null;
    if (r?.status === 'approved') perms = cleanPerms(r.perms, cleanPerms(d.link_perms, PRESETS.view));
    else request = r?.status || 'none';
  }
  if (!perms || !perms.view) return { design: d, role: null, perms: NONE, request: request || 'none', needsName: !user && !guest?.name };
  return {
    design: d,
    role: perms.edit ? 'edit' : 'view',
    perms,
    request: null,
    needsName: !user && !guest?.name,
  };
}

export const canEdit = (role) => role === 'owner' || role === 'edit';
