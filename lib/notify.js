import 'server-only';
import { newId } from './auth';
import { q } from './db';

/** A person's inbox, newest first. */
export async function inboxItems(userId) {
  return q(
    `SELECT n.id, n.type, n.design_id, n.actor_name, n.data, n.status, n.read_at, n.created_at,
            a.username AS actor_username, a.picture AS actor_picture,
            d.title AS design_title, d.thumb AS design_thumb
     FROM notifications n
     LEFT JOIN users a ON a.id = n.actor_id
     LEFT JOIN designs d ON d.id = n.design_id
     WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 150`,
    [userId]
  );
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
