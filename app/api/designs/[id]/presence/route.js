import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { canEdit, loadDesign } from '@/lib/access';

export const dynamic = 'force-dynamic';

const COLORS = ['#e40014', '#155dfc', '#f97316', '#7c3aed', '#ec4899', '#0891b2', '#65a30d', '#ca8a04'];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Live cursors: each open editor with "Live" turned on posts where its cursor is (about twice a second)
// and gets back everyone else's, plus the design's current version so it can pull in their saved changes.
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  const b = await request.json().catch(() => ({}));
  const sess = String(b.sess || '').replace(/[^\w-]/g, '').slice(0, 40);
  if (!sess) return json({ error: 'Missing session' }, 400);
  if (b.leave) {
    await q('DELETE FROM design_presence WHERE design_id = $1 AND sess = $2', [id, sess]);
    return json({ ok: true });
  }
  const color = COLORS[[...sess].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
  await q(
    `INSERT INTO design_presence (design_id, sess, user_id, name, color, page, x, y, sel, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (design_id, sess) DO UPDATE SET page = EXCLUDED.page, x = EXCLUDED.x, y = EXCLUDED.y, sel = EXCLUDED.sel, name = EXCLUDED.name, updated_at = NOW()`,
    [id, sess, user.id, String(user.name || user.username || 'Someone').slice(0, 40), color, Math.max(0, Math.min(999, Number(b.page) || 0)), num(b.x), num(b.y), b.sel ? String(b.sel).slice(0, 20) : null]
  );
  const people = await q(
    `SELECT sess, name, color, page, x, y, sel FROM design_presence
     WHERE design_id = $1 AND sess <> $2 AND updated_at > NOW() - INTERVAL '8 seconds' ORDER BY name`,
    [id, sess]
  );
  // Tidy up rows from editors that closed without saying goodbye.
  if (Math.random() < 0.05) await q(`DELETE FROM design_presence WHERE updated_at < NOW() - INTERVAL '1 hour'`);
  const ver = await one('SELECT updated_at::text AS v FROM designs WHERE id = $1', [id]);
  return json({ people, version: ver?.v || null, color });
});
