import { handler, json, newId, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { normalizeDesign } from '@/lib/design';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await q('SELECT id, title, width, height, data, visibility, updated_at FROM designs WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 200', [user.id]);
  return json({ designs: rows });
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const design = normalizeDesign(body.design || body);
  const id = newId();
  const title = String(body.title || 'Untitled design').slice(0, 120);
  await q(
    'INSERT INTO designs (id, owner_id, title, width, height, data) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
    [id, user.id, title, design.width, design.height, JSON.stringify(design)]
  );
  return json({ id }, 201);
});
