import { getUser, handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Built-in AI, on Groq's free tier (https://console.groq.com). Set GROQ_API_KEY in Vercel to turn it on.
// GROQ_MODEL picks the model (default openai/gpt-oss-120b); AI_DAILY_LIMIT is requests per person per day (default 40).
const KEY = () => process.env.GROQ_API_KEY || '';
const MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const LIMIT = () => Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 40);

async function usedToday(userId) {
  const r = await one('SELECT count FROM ai_usage WHERE user_id = $1 AND day = CURRENT_DATE', [userId]);
  return r?.count || 0;
}

// Is built-in AI on, and how many requests do you have left today?
export const GET = handler(async () => {
  const user = await getUser();
  if (!KEY() || !user) return json({ available: false });
  const used = await usedToday(user.id).catch(() => 0);
  return json({ available: true, left: Math.max(0, LIMIT() - used), limit: LIMIT() });
});

// Ask the AI. Body: { prompt, system? }. Returns { text, left }.
export const POST = handler(async (request) => {
  const user = await requireUser();
  if (!KEY()) return json({ error: 'Built-in AI isn’t set up on this site yet.' }, 503);
  const b = await request.json().catch(() => ({}));
  const prompt = String(b.prompt || '').slice(0, 60_000);
  if (!prompt.trim()) return json({ error: 'Nothing to ask.' }, 400);

  // Count the request first, so many tabs at once can't go over the limit.
  const row = await one(
    `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 RETURNING count`, [user.id]);
  if (row.count > LIMIT()) {
    await q('UPDATE ai_usage SET count = count - 1 WHERE user_id = $1 AND day = CURRENT_DATE', [user.id]);
    return json({ error: `You’ve used today’s ${LIMIT()} AI requests. They come back tomorrow, or use “another AI” below.`, left: 0 }, 429);
  }
  const refund = () => q('UPDATE ai_usage SET count = GREATEST(0, count - 1) WHERE user_id = $1 AND day = CURRENT_DATE', [user.id]).catch(() => {});

  let r;
  try {
    r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL(),
        messages: [
          { role: 'system', content: String(b.system || 'You are the AI built into Jace Design, a design app. Follow the instructions exactly and reply only with what is asked for.').slice(0, 4000) },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 8192,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    await refund();
    return json({ error: 'The AI took too long to answer. Try again, or try something shorter.' }, 504);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    await refund();
    const msg = d?.error?.message || '';
    if (r.status === 429) return json({ error: 'The free AI is busy right now (too many requests at once). Wait a minute and try again, or use “another AI” below.' }, 429);
    if (r.status === 413 || /too large|context|tokens/i.test(msg)) return json({ error: 'That’s too much for the free AI in one go. Try a smaller request (one page instead of the whole design), or use “another AI” below.' }, 413);
    console.error('Groq error', r.status, msg);
    return json({ error: 'The AI couldn’t answer just now. Try again in a moment.' }, 502);
  }
  const text = d?.choices?.[0]?.message?.content || '';
  if (!text.trim()) { await refund(); return json({ error: 'The AI gave an empty answer. Try again.' }, 502); }
  return json({ text, left: Math.max(0, LIMIT() - row.count) });
});
