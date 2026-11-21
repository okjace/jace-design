import { handler, json, newId, requireUser, getUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { canEdit, loadDesign } from '@/lib/access';
import { lighten, listCols } from '@/lib/preview';

export const dynamic = 'force-dynamic';

// GET /api/templates?scope=mine|community&q=
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') === 'mine' ? 'mine' : 'community';
  const term = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const user = await getUser();
  if (scope === 'mine' && !user) return json({ templates: [] });
  const rows = scope === 'mine'
    ? await q(`SELECT d.id, d.title, d.width, d.height, ${listCols('d')}, d.visibility, d.category, u.username, u.name, u.picture
               FROM designs d JOIN users u ON u.id = d.owner_id
               WHERE d.is_template AND d.owner_id = $1 AND ($2 = '' OR d.title ILIKE '%' || $2 || '%')
               ORDER BY d.updated_at DESC LIMIT 100`, [user.id, term])
    : await q(`SELECT d.id, d.title, d.width, d.height, ${listCols('d')}, d.visibility, d.category, u.username, u.name, u.picture,
                      (SELECT COUNT(*)::int FROM designs r WHERE r.remix_of = d.id) AS uses
               FROM designs d JOIN users u ON u.id = d.owner_id
               WHERE d.is_template AND d.visibility = 'public' AND ($1 = '' OR d.title ILIKE '%' || $1 || '%' OR d.category ILIKE '%' || $1 || '%')
               ORDER BY uses DESC, d.created_at DESC LIMIT 100`, [term]);
  return json({ templates: lighten(rows) });
});

// POST /api/templates { from, title, category, visibility } — save a snapshot of a design as a template.
export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json();
  const { design, role } = await loadDesign(String(body.from || ''), user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  const id = newId();
  const visibility = body.visibility === 'public' ? 'public' : 'private';
  await q(
    `INSERT INTO designs (id, owner_id, title, width, height, data, visibility, is_template, category)
     VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, TRUE, $8)`,
    [id, user.id, String(body.title || design.title).slice(0, 120), design.width, design.height, JSON.stringify(design.data), visibility, String(body.category || '').slice(0, 40)]
  );
  return json({ id }, 201);
});
