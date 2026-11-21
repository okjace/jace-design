import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { canEdit, loadDesign } from '@/lib/access';

export const dynamic = 'force-dynamic';

const COLORS = ['#e40014', '#155dfc', '#f97316', '#7c3aed', '#ec4899', '#0891b2', '#65a30d', '#ca8a04'];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const cleanSess = (s) => String(s || '').replace(/[^\w-]/g, '').slice(0, 40);

// Who else is here (editors check in at least every 20 s, so 45 s without news means they left)
// and the design's current version (so an editor can pull in changes someone saved).
async function snapshot(id, sess) {
  const [people, ver] = await Promise.all([
    q(`SELECT sess, name, color, page, x, y, sel FROM design_presence
       WHERE design_id = $1 AND sess <> $2 AND updated_at > NOW() - INTERVAL '45 seconds' ORDER BY name, sess`, [id, sess]),
    one('SELECT updated_at::text AS v FROM designs WHERE id = $1', [id]),
  ]);
  return { people, version: ver?.v || null };
}

async function check(params) {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return { error: json({ error: 'Not found' }, 404) };
  return { id, user, design };
}

// A quick look (only reads): has anything changed? The editor asks every couple of seconds and
// only redraws when the answer is different.
export const GET = handler(async (request, ctx) => {
  const c = await check(ctx.params);
  if (c.error) return c.error;
  const sp = new URL(request.url).searchParams;
  const snap = await snapshot(c.id, cleanSess(sp.get('sess')));
  // If the editor's version is out of date, send the new design along (saves a second trip).
  const have = sp.get('v') || '';
  if (have && snap.version && have !== snap.version) {
    const cur = await one('SELECT data, title, updated_at::text AS v FROM designs WHERE id = $1', [c.id]);
    if (cur) { snap.version = cur.v; snap.design = { data: cur.data, title: cur.title }; }
  }
  return json(snap);
});

// Your cursor/selection moved (sent only when it changes, plus a check-in every 20 s), or you left.
export const POST = handler(async (request, ctx) => {
  const c = await check(ctx.params);
  if (c.error) return c.error;
  const { id, user } = c;
  const b = await request.json().catch(() => ({}));
  const sess = cleanSess(b.sess);
  if (!sess) return json({ error: 'Missing session' }, 400);
  if (b.leave) {
    await q('DELETE FROM design_presence WHERE design_id = $1 AND sess = $2', [id, sess]);
    return json({ ok: true });
  }
  const color = COLORS[[...sess].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLORS.length];
  await q(
    `INSERT INTO design_presence (design_id, sess, user_id, name, color, page, x, y, sel, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (design_id, sess) DO UPDATE SET page = EXCLUDED.page, x = EXCLUDED.x, y = EXCLUDED.y, sel = EXCLUDED.sel, name = EXCLUDED.name, updated_at = NOW()`,
    [id, sess, user.id, String(user.name || user.username || 'Someone').slice(0, 40), color, Math.max(0, Math.min(999, Number(b.page) || 0)), num(b.x), num(b.y), b.sel ? String(b.sel).slice(0, 20) : null]
  );
  // Tidy up rows from editors that closed without saying goodbye.
  if (Math.random() < 0.02) await q(`DELETE FROM design_presence WHERE updated_at < NOW() - INTERVAL '1 hour'`);
  return json({ ...(await snapshot(id, sess)), color });
});
