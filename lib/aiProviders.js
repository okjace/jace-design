import 'server-only';

// Free AI services that speak the same "chat completions" language. Whichever keys are set in Vercel are used,
// in this order; if one is busy or out of free requests, the next one is tried.
//   GEMINI_API_KEY      free key from https://aistudio.google.com/apikey   (GEMINI_MODEL to pick a model)
//   GROQ_API_KEY        free key from https://console.groq.com/keys        (GROQ_MODEL)
//   OPENROUTER_API_KEY  free key from https://openrouter.ai/keys           (OPENROUTER_MODEL; free models only by default)
const PROVIDERS = [
  { id: 'gemini', name: 'Gemini', key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL', base: 'https://generativelanguage.googleapis.com/v1beta/openai', pick: pickGemini },
  { id: 'groq', name: 'Groq', key: 'GROQ_API_KEY', model: 'GROQ_MODEL', base: 'https://api.groq.com/openai/v1', pick: async () => 'openai/gpt-oss-120b' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL', base: 'https://openrouter.ai/api/v1', pick: pickOpenRouter },
];

export const configured = () => PROVIDERS.filter((p) => process.env[p.key]);

// Model names change often, so when no model is set, ask the service which ones it has and take a good free one.
const picked = new Map();
async function modelFor(p) {
  if (process.env[p.model]) return process.env[p.model];
  const hit = picked.get(p.id);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.model;
  const model = await p.pick(p).catch(() => null);
  if (model) picked.set(p.id, { model, at: Date.now() });
  return model;
}

async function listModels(p) {
  const r = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${process.env[p.key]}` }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.data || d.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
}

const version = (id) => Number((id.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0);

async function pickGemini(p) {
  const ids = (await listModels(p)).filter((id) => /^gemini-/.test(id) && /flash/.test(id) && !/(lite|image|tts|live|audio|thinking|embedding|exp|preview)/.test(id));
  ids.sort((a, b) => version(b) - version(a) || a.length - b.length);
  return ids[0] || 'gemini-flash-latest';
}

async function pickOpenRouter(p) {
  const ids = (await listModels(p)).filter((id) => id.endsWith(':free'));
  const pref = [/gpt-oss-120b/, /llama-3\.3-70b/, /deepseek/, /qwen/, /gemma/];
  for (const re of pref) { const hit = ids.find((id) => re.test(id)); if (hit) return hit; }
  return ids[0] || null;
}

/** Ask the first service that answers. Returns { text, provider } or throws { status, message }. */
export async function chat({ system, prompt, maxTokens = 8192 }) {
  const list = configured();
  if (!list.length) throw Object.assign(new Error('Built-in AI isn’t set up on this site yet.'), { status: 503 });
  let last = null;
  for (const p of list) {
    const model = await modelFor(p);
    if (!model) { last = { status: 502, message: `${p.name} has no free model available right now.` }; continue; }
    let r;
    try {
      r = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env[p.key]}`, 'Content-Type': 'application/json', ...(p.id === 'openrouter' ? { 'X-Title': 'Jace Design' } : {}) },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.7 }),
        signal: AbortSignal.timeout(50_000),
      });
    } catch {
      last = { status: 504, message: 'The AI took too long to answer. Try again, or try something shorter.' };
      continue;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = d?.choices?.[0]?.message?.content || '';
      if (text.trim()) return { text, provider: p.name };
      last = { status: 502, message: 'The AI gave an empty answer. Try again.' };
      continue;
    }
    const msg = String(d?.error?.message || d?.[0]?.error?.message || '');
    if (r.status === 404) picked.delete(p.id); // that model was retired: pick again next time
    console.error(`AI ${p.id} error`, r.status, msg.slice(0, 300));
    if (r.status === 429) last = { status: 429, message: 'The free AI is busy or out of free requests for now. Wait a bit and try again, or use “another AI” below.' };
    else if (r.status === 413 || /too large|too long|context length|maximum.*tokens/i.test(msg)) last = { status: 413, message: 'That’s too much for the free AI in one go. Try a smaller request (one page instead of the whole design), or use “another AI” below.' };
    else last = { status: 502, message: 'The AI couldn’t answer just now. Try again in a moment.' };
  }
  throw Object.assign(new Error(last.message), { status: last.status });
}
