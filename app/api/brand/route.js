import { handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

const HEX = /^#[0-9a-f]{6}$/i;
const IMG = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

function clean(d = {}) {
  const colors = [...new Set((Array.isArray(d.colors) ? d.colors : []).filter((c) => HEX.test(c)).map((c) => c.toLowerCase()))].slice(0, 24);
  const fonts = [...new Set((Array.isArray(d.fonts) ? d.fonts : []).map((f) => String(f || '').replace(/[^\w \-]/g, '').trim().slice(0, 60)).filter(Boolean))].slice(0, 12);
  const logos = (Array.isArray(d.logos) ? d.logos : [])
    .filter((l) => l && typeof l.src === 'string' && IMG.test(l.src) && l.src.length < 700_000)
    .slice(0, 8)
    .map((l) => ({ id: String(l.id || Math.random().toString(36).slice(2, 10)).slice(0, 20), src: l.src, name: String(l.name || 'Logo').slice(0, 60), width: Number(l.width) || 400, height: Number(l.height) || 400 }));
  return { colors, fonts, logos, name: String(d.name || '').slice(0, 60) };
}

// Your brand kit: colors, fonts and logos you can use in any design.
export const GET = handler(async () => {
  const user = await requireUser();
  const row = await one('SELECT data FROM brand_kits WHERE user_id = $1', [user.id]);
  return json({ brand: clean(row?.data || {}) });
});

export const PUT = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const brand = clean(body.brand || {});
  await q(
    `INSERT INTO brand_kits (user_id, data, updated_at) VALUES ($1, $2::text::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [user.id, JSON.stringify(brand)]
  );
  return json({ ok: true, brand });
});
