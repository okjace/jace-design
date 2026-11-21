import { getUser, handler, json, newId, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 300; // per person
const PER_PAGE = 30;
const IMG = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Browse Jace Photos.
//   scope=community (default): everyone's public photos   scope=mine: all of yours   scope=user&username=x: x's public photos
export const GET = handler(async (request) => {
  const sp = new URL(request.url).searchParams;
  const scope = sp.get('scope') || 'community';
  const term = clean(sp.get('q'), 80);
  const page = Math.max(1, Math.min(50, Number(sp.get('page')) || 1));
  const user = await getUser();
  const where = [];
  const vals = [];
  if (scope === 'mine') {
    if (!user) return json({ error: 'Sign in required' }, 401);
    vals.push(user.id); where.push(`p.owner_id = $${vals.length}`);
  } else if (scope === 'user') {
    vals.push(clean(sp.get('username'), 60).toLowerCase()); where.push(`LOWER(u.username) = $${vals.length}`);
    where.push('p.public');
  } else {
    where.push('p.public');
  }
  if (term) {
    vals.push(`%${term}%`);
    where.push(`(p.title ILIKE $${vals.length} OR p.tags ILIKE $${vals.length} OR u.username ILIKE $${vals.length})`);
  }
  vals.push(PER_PAGE + 1); const lim = vals.length;
  vals.push((page - 1) * PER_PAGE); const off = vals.length;
  const rows = await q(
    `SELECT p.id, p.title, p.tags, p.width, p.height, p.thumb, p.public, p.uses, p.created_at, u.username, u.name
     FROM photos p JOIN users u ON u.id = p.owner_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.created_at DESC LIMIT $${lim} OFFSET $${off}`,
    vals
  );
  return json({ photos: rows.slice(0, PER_PAGE), hasMore: rows.length > PER_PAGE, page });
});

// Upload a photo (already made smaller in the browser, with a little preview picture).
export const POST = handler(async (request) => {
  const user = await requireUser();
  const b = await request.json().catch(() => ({}));
  const m = IMG.exec(String(b.image || ''));
  if (!m) return json({ error: 'That isn’t a JPG, PNG or WebP image.' }, 400);
  const data = Buffer.from(m[3], 'base64');
  if (data.length > 3_000_000) return json({ error: 'That photo is too big (3 MB at most after shrinking).' }, 413);
  const thumb = String(b.thumb || '');
  if (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(thumb) || thumb.length > 120_000) return json({ error: 'Missing preview.' }, 400);
  const n = await one('SELECT COUNT(*)::int AS n FROM photos WHERE owner_id = $1', [user.id]);
  if (n.n >= MAX_PHOTOS) return json({ error: `You can have up to ${MAX_PHOTOS} photos. Delete some to add more.` }, 400);
  const id = newId(16);
  await q(
    `INSERT INTO photos (id, owner_id, title, tags, width, height, mime, size, thumb, public) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, user.id, clean(b.title, 100), clean(b.tags, 200), Math.round(Number(b.width) || 0), Math.round(Number(b.height) || 0), m[1], data.length, thumb, b.public !== false]
  );
  await q('INSERT INTO photo_data (photo_id, data) VALUES ($1, $2)', [id, data]);
  return json({ ok: true, id });
});
