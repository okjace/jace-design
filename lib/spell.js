'use client';
// Spell checking in the browser with a free English (US) dictionary (Hunspell, via nspell). Nothing is sent anywhere.
const BASE = 'https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0';
const IGNORE_KEY = 'jd_spell_ignore';

let loading = null;
export function getSpeller() {
  if (!loading) {
    loading = (async () => {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import('nspell'),
        fetch(`${BASE}/index.aff`).then((r) => { if (!r.ok) throw new Error('Could not load the dictionary.'); return r.text(); }),
        fetch(`${BASE}/index.dic`).then((r) => { if (!r.ok) throw new Error('Could not load the dictionary.'); return r.text(); }),
      ]);
      const sp = nspell(aff, dic);
      for (const w of ignored()) sp.add(w);
      return sp;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

export function ignored() {
  try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'); } catch { return []; }
}
/** "Add to dictionary": never flag this word again (in this browser). */
export async function ignoreWord(word) {
  const list = [...new Set([...ignored(), word])].slice(-2000);
  try { localStorage.setItem(IGNORE_KEY, JSON.stringify(list)); } catch {}
  (await getSpeller()).add(word);
}

const WORD = /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’]*/g;

/** Misspelled words in some text: [{ word, index, suggestions }]. Skips names in CAPS, links, emails and words with numbers. */
export function findMistakes(sp, text) {
  const out = [];
  const s = String(text || '');
  const skip = [];
  for (const m of s.matchAll(/\S*(https?:\/\/|www\.|@)\S*/g)) skip.push([m.index, m.index + m[0].length]);
  for (const m of s.matchAll(WORD)) {
    let w = m[0].replace(/['’]+$/, '');
    if (w.length < 2) continue;
    if (skip.some(([a, b]) => m.index >= a && m.index < b)) continue;
    if (/^[A-Z]{2,}$/.test(w)) continue; // acronyms
    const prev = s[m.index - 1], next = s[m.index + m[0].length];
    if (/\d/.test(prev || '') || /\d/.test(next || '')) continue;
    w = w.replace(/’/g, "'");
    if (sp.correct(w) || sp.correct(w.toLowerCase())) continue;
    out.push({ word: m[0].replace(/['’]+$/, ''), index: m.index, suggestions: sp.suggest(w).slice(0, 5) });
  }
  return out;
}

/** Replace one occurrence (at `index`) of `word` with `fix`. */
export function applyFix(text, index, word, fix) {
  return text.slice(0, index) + fix + text.slice(index + word.length);
}
