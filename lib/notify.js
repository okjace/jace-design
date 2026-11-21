import 'server-only';
import { newId } from './auth';
import { q } from './db';

/**
 * SQL condition (for a notifications row aliased `n`) that hides design invites you can no longer use:
 * the invite is only shown while you still have that design shared with you and can view it.
 */
export const VISIBLE = `NOT (n.type = 'share' AND NOT EXISTS (
  SELECT 1 FROM shares s WHERE s.design_id = n.design_id AND s.user_id = n.user_id
    AND COALESCE((s.perms->>'view')::boolean, true)))`;

/** A person's inbox, newest first. */
export async function inboxItems(userId) {
  return q(
    `SELECT n.id, n.type, n.design_id, n.actor_name, n.data, n.status, n.read_at, n.created_at,
            a.username AS actor_username, a.picture AS actor_picture,
            d.title AS design_title, d.thumb AS design_thumb
     FROM notifications n
     LEFT JOIN users a ON a.id = n.actor_id
     LEFT JOIN designs d ON d.id = n.design_id
     WHERE n.user_id = $1 AND ${VISIBLE} ORDER BY n.created_at DESC LIMIT 150`,
    [userId]
  );
}

export async function unreadCount(userId) {
  const rows = await q(`SELECT COUNT(*)::int AS n FROM notifications n WHERE n.user_id = $1 AND n.read_at IS NULL AND ${VISIBLE}`, [userId]);
  return rows[0]?.n || 0;
}

/** Remove someone's invite for a design (after they accept or decline it, or lose access). */
export async function clearInvite(userId, designId) {
  await q(`DELETE FROM notifications WHERE user_id = $1 AND design_id = $2 AND type = 'share'`, [userId, designId]).catch(() => {});
}

/**
 * Put something in a person's Jace Design inbox.
 * type: 'share' (a design invite) | 'comment' | 'follow' | 'remix' | 'access_request' | 'access_granted'
 */
export async function notify(userId, { type, designId = null, actor = null, actorName = null, data = null }) {
  if (!userId || (actor && actor.id === userId)) return;
  try {
    // Don't stack duplicates of the same invite: refresh the existing one instead.
    if (type === 'share' && designId) {
      await q(`DELETE FROM notifications WHERE user_id = $1 AND type = 'share' AND design_id = $2`, [userId, designId]);
    }
    await q(
      `INSERT INTO notifications (id, user_id, type, design_id, actor_id, actor_name, data) VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb)`,
      [newId(), userId, type, designId, actor?.id || null, actorName || actor?.name || actor?.username || null, JSON.stringify(data || {})]
    );
  } catch (e) {
    console.warn('notify failed', e);
  }
}
