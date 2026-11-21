import { handler, json, newId, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { normalizeDesign } from '@/lib/design';
import { sanitizeDesign } from '@/lib/sanitize';
import { shareDefaults } from '@/lib/access';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await q('SELECT id, title, width, height, data, visibility, is_template, updated_at FROM designs WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 200', [user.id]);
  return json({ designs: rows });
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const design = sanitizeDesign(normalizeDesign(body.design || body));
  const id = newId();
  const title = String(body.title || 'Untitled design').slice(0, 120);
  const def = shareDefaults(user);
  await q(
    `INSERT INTO designs (id, owner_id, title, width, height, data, visibility, link_perms, require_request)
     VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8::text::jsonb, $9)`,
    [id, user.id, title, design.width, design.height, JSON.stringify(design), def.visibility, JSON.stringify(def.link_perms), def.require_request]
  );
  return json({ id }, 201);
});
