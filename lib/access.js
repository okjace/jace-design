import 'server-only';
import { one } from './db';

/** Load a design and work out what `user` may do with it. */
export async function loadDesign(id, user) {
  const d = await one(
    `SELECT d.*, u.username AS owner_username, u.name AS owner_name, u.picture AS owner_picture
     FROM designs d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
    [id]
  );
  if (!d) return { design: null, role: null };
  let role = null;
  if (user && d.owner_id === user.id) role = 'owner';
  else if (user) {
    const s = await one('SELECT role FROM shares WHERE design_id = $1 AND user_id = $2', [id, user.id]);
    if (s) role = s.role === 'edit' ? 'edit' : 'view';
  }
  if (!role && (d.visibility === 'public' || d.visibility === 'link')) role = 'view';
  return { design: d, role };
}

export const canEdit = (role) => role === 'owner' || role === 'edit';
