import 'server-only';
import { one, q } from './db';

const KEEP_AUTO = 25; // automatic snapshots kept per design (named versions are kept until deleted)
const MAX_SIZE = 2_500_000; // very big designs (lots of photos) only get named versions, to save space

/**
 * Before a save, keep a copy of the design as it was — at most one automatic copy every 10 minutes,
 * so each editing session gets a version to go back to. Never makes the save itself fail.
 */
export async function snapshotVersion(designId, userId, { name = null, force = false } = {}) {
  try {
    const rows = await q(
      `INSERT INTO design_versions (design_id, data, title, name, user_id, size)
       SELECT d.id, d.data, d.title, $3::text, $2::text, octet_length(d.data::text) FROM designs d
       WHERE d.id = $1
         AND ($4::boolean OR NOT EXISTS (SELECT 1 FROM design_versions v WHERE v.design_id = $1 AND v.name IS NULL AND v.created_at > NOW() - INTERVAL '10 minutes'))
         AND ($4::boolean OR octet_length(d.data::text) < ${MAX_SIZE})
       RETURNING id`,
      [designId, userId || null, name, force]
    );
    if (rows.length && !name) {
      await q(
        `DELETE FROM design_versions WHERE design_id = $1 AND name IS NULL AND id NOT IN
         (SELECT id FROM design_versions WHERE design_id = $1 AND name IS NULL ORDER BY created_at DESC LIMIT ${KEEP_AUTO})`,
        [designId]
      );
    }
    return rows[0]?.id || null;
  } catch (e) {
    console.error('version snapshot failed', e);
    return null;
  }
}

export function listVersions(designId) {
  return q(
    `SELECT v.id::text AS id, v.title, v.name, v.size, v.created_at, u.username, u.name AS user_name
     FROM design_versions v LEFT JOIN users u ON u.id = v.user_id
     WHERE v.design_id = $1 ORDER BY v.created_at DESC LIMIT 80`,
    [designId]
  );
}

export function getVersion(designId, vid) {
  if (!/^\d+$/.test(String(vid))) return null;
  return one('SELECT id::text AS id, data, title, name, created_at FROM design_versions WHERE design_id = $1 AND id = $2::bigint', [designId, vid]);
}
