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

// OpenRouter: the best free models, in order. Fast, non-"thinking" models first, so answers start quickly.
async function pickOpenRouter(p) {
  const ids = (await listModels(p)).filter((id) => id.endsWith(':free') && !/(vl|omni|vision|audio|nano|1\.7b|reasoning)/i.test(id));
  const pref = [/gemma-4-31b/, /gpt-oss-120b/, /gemma-4/, /llama-3\.3-70b/, /nemotron-3\.5-super/, /flash/, /deepseek/, /qwen/, /nemotron/];
  const out = [];
  for (const re of pref) for (const id of ids) if (re.test(id) && !out.includes(id)) out.push(id);
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out.length ? out.slice(0, 4).join(',') : null;
}

const enc = new TextEncoder();

// Read a streamed answer ("server-sent events"). Yields { text } for the answer as it's written, and { alive }
// whenever the AI shows it's still working (thinking, or "still processing" notes), so slow models aren't cut off.
async function* answerChunks(reader) {
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith(':')) { yield { alive: true }; continue; } // e.g. ": OPENROUTER PROCESSING"
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      let j;
      try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw Object.assign(new Error(String(j.error.message || 'The AI stopped with an error.')), { status: 502 });
      const d = j.choices?.[0]?.delta || {};
      if (d.content) yield { text: d.content };
      else yield { alive: true };
    }
  }
}

const friendly = (status, msg) => {
  if (status === 429) return { status: 429, message: 'The free AI is busy or out of free requests for now. Wait a bit and try again, or use “another AI” below.' };
  if (status === 413 || /too large|too long|context length|maximum.*tokens/i.test(msg)) return { status: 413, message: 'That’s too much for the free AI in one go. Try a smaller request (one page instead of the whole design), or use “another AI” below.' };
  return { status: 502, message: 'The AI couldn’t answer just now. Try again in a moment.' };
};

const QUIET = 45_000; // a model that shows no sign of life for this long is given up on

/**
 * Ask the AI and stream the answer. Tries each service (and each free model) until one starts answering with
 * real text: busy, broken, silent or empty answers move on to the next. Slow but working models get time.
 * Returns { stream, provider, model }: `stream` gives the answer's text as it's written. Throws { status, message }.
 */
export async function streamChat({ system, prompt, maxTokens = 8192, deadline = Date.now() + 280_000 }) {
  const list = configured();
  if (!list.length) throw Object.assign(new Error('Built-in AI isn’t set up on this site yet.'), { status: 503 });
  let last = { status: 502, message: 'The AI couldn’t answer just now. Try again in a moment.' };
  for (const p of list) {
    const models = String((await modelFor(p)) || '').split(',').filter(Boolean);
    if (!models.length) { last = { status: 502, message: `${p.name} has no free model available right now.` }; continue; }
    for (const model of models) {
      const left = deadline - Date.now();
      if (left < 10_000) { last = { status: 504, message: 'The free AI is slow right now. Try again in a moment, or use “another AI” below.' }; break; }
      const ctrl = new AbortController();
      const stopAll = setTimeout(() => ctrl.abort(), left); // never run past the page's time limit
      let lastSign = Date.now();
      const watch = setInterval(() => { if (Date.now() - lastSign > QUIET) ctrl.abort(); }, 2000);
      const done = () => { clearTimeout(stopAll); clearInterval(watch); };
      try {
        const r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env[p.key]}`, 'Content-Type': 'application/json', ...(p.id === 'openrouter' ? { 'X-Title': 'Jace Design' } : {}) },
          body: JSON.stringify({
            model, stream: true, max_tokens: maxTokens, temperature: 0.7,
            messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            // Thinking models: think briefly; their thinking still streams (not shown) so we know they're working.
            ...(p.id === 'openrouter' ? { reasoning: { effort: 'low' } } : {}),
          }),
          signal: ctrl.signal,
        });
        lastSign = Date.now();
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          const msg = String(d?.error?.message || '');
          console.error(`AI ${p.id}/${model} error`, r.status, msg.slice(0, 200));
          if (r.status === 404) picked.delete(p.id); // retired model: choose again next time
          last = friendly(r.status, msg);
          done();
          if (r.status === 413) throw Object.assign(new Error(last.message), { status: 413 }); // a smaller model won't help
          continue;
        }
        const chunks = answerChunks(r.body.getReader());
        // Wait for the first real text (thinking keeps it alive).
        let first = null;
        for (;;) {
          const n = await chunks.next();
          lastSign = Date.now();
          if (n.done) break;
          if (n.value.text) { first = n.value.text; break; }
        }
        if (first == null) { done(); ctrl.abort(); last = { status: 502, message: 'The AI gave an empty answer. Try again.' }; console.error(`AI ${p.id}/${model} empty answer`); continue; }
        const stream = new ReadableStream({
          start(c) { c.enqueue(enc.encode(first)); },
          async pull(c) {
            try {
              for (;;) {
                const n = await chunks.next();
                lastSign = Date.now();
                if (n.done) { done(); c.close(); return; }
                if (n.value.text) { c.enqueue(enc.encode(n.value.text)); return; }
              }
            } catch { done(); c.close(); }
          },
          cancel() { done(); ctrl.abort(); },
        });
        return { stream, provider: p.name, model };
      } catch (e) {
        done();
        if (e.status === 413) throw e;
        console.error(`AI ${p.id}/${model} failed`, e.name, String(e.message || '').slice(0, 200));
        last = e.name === 'AbortError' || e.name === 'TimeoutError'
          ? { status: 504, message: 'The free AI is slow right now. Try again in a moment, or use “another AI” below.' }
          : (e.status ? { status: e.status, message: 'The AI couldn’t answer just now. Try again in a moment.' } : last);
      }
    }
  }
  throw Object.assign(new Error(last.message), { status: last.status });
}
