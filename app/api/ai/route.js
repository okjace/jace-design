import { getUser, handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { chat, configured } from '@/lib/aiProviders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Built-in AI on free AI services (see lib/aiProviders.js for which keys turn it on).
// AI_DAILY_LIMIT is requests per person per day (default 40).
const LIMIT = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 40);

// Is built-in AI on, and how many requests do you have left today?
export const GET = handler(async () => {
  const user = await getUser();
  if (!configured().length || !user) return json({ available: false });
  const r = await one('SELECT count FROM ai_usage WHERE user_id = $1 AND day = CURRENT_DATE', [user.id]).catch(() => null);
  return json({ available: true, left: Math.max(0, LIMIT() - (r?.count || 0)), limit: LIMIT() });
});

// Ask the AI. Body: { prompt, system? }. Returns { text, left }.
export const POST = handler(async (request) => {
  const user = await requireUser();
  if (!configured().length) return json({ error: 'Built-in AI isn’t set up on this site yet.' }, 503);
  const b = await request.json().catch(() => ({}));
  const prompt = String(b.prompt || '').slice(0, 60_000);
  if (!prompt.trim()) return json({ error: 'Nothing to ask.' }, 400);

  // Count the request first, so many tabs at once can't go over the limit; give it back if the AI fails.
  const row = await one(
    `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 RETURNING count`, [user.id]);
  const refund = () => q('UPDATE ai_usage SET count = GREATEST(0, count - 1) WHERE user_id = $1 AND day = CURRENT_DATE', [user.id]).catch(() => {});
  if (row.count > LIMIT()) {
    await refund();
    return json({ error: `You’ve used today’s ${LIMIT()} AI requests. They come back tomorrow, or use “another AI” below.`, left: 0 }, 429);
  }
  try {
    const { text } = await chat({
      system: String(b.system || 'You are the AI built into Jace Design, a design app. Follow the instructions exactly and reply only with what is asked for.').slice(0, 4000),
      prompt,
    });
    return json({ text, left: Math.max(0, LIMIT() - row.count) });
  } catch (e) {
    await refund();
    return json({ error: e.message }, e.status || 502);
  }
});
