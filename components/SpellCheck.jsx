'use client';
import { useEffect, useMemo, useState } from 'react';
import { applyFix, findMistakes, getSpeller, ignoreWord } from '@/lib/spell';

// Where text lives in a design: text elements, and table cells.
function textsOf(pages) {
  const out = [];
  pages.forEach((p, pi) => p.elements.forEach((e) => {
    if (e.type === 'text') out.push({ pi, id: e.id, path: null, text: e.text });
    if (e.type === 'table') (e.rows || []).forEach((row, r) => row.forEach((cell, c) => out.push({ pi, id: e.id, path: [r, c], text: String(cell ?? '') })));
  }));
  return out;
}

/**
 * Spell check for a whole design. api: { pages, editText(pi, id, path, newText), goTo(pi, id) }.
 * Also used as a compact list for one selected text (`only` = that element's id).
 */
export default function SpellCheck({ api, onClose, only }) {
  const [sp, setSp] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { getSpeller().then(setSp).catch((e) => setErr(e.message)); }, []);

  const issues = useMemo(() => {
    if (!sp) return [];
    const list = [];
    for (const t of textsOf(api.pages)) {
      if (only && t.id !== only) continue;
      for (const m of findMistakes(sp, t.text)) list.push({ ...t, ...m });
    }
    return list;
  }, [sp, api.pages, only, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const fix = (it, word) => api.editText(it.pi, it.id, it.path, applyFix(it.text, it.index, it.word, word));
  const fixAll = () => {
    // Fix from the end of each text so earlier positions stay right.
    const byText = new Map();
    for (const it of issues) {
      if (!it.suggestions.length) continue;
      const key = `${it.pi}|${it.id}|${it.path || ''}`;
      if (!byText.has(key)) byText.set(key, { ...it, fixes: [] });
      byText.get(key).fixes.push(it);
    }
    for (const t of byText.values()) {
      let text = t.text;
      for (const f of [...t.fixes].sort((a, b) => b.index - a.index)) text = applyFix(text, f.index, f.word, f.suggestions[0]);
      api.editText(t.pi, t.id, t.path, text);
    }
  };

  if (err) return <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>;
  if (!sp) return <p className="small muted">Loading the dictionary…</p>;
  if (!issues.length) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <p className="small" style={{ margin: 0 }}>✓ No spelling mistakes found{only ? ' in this text' : ''}.</p>
        {onClose ? <button className="btn btn-primary" onClick={onClose}>Done</button> : null}
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!only ? (
        <div className="row">
          <span className="grow small">{issues.length} possible mistake{issues.length === 1 ? '' : 's'}</span>
          <button className="btn btn-sm btn-primary" onClick={fixAll}>Fix all (best guess)</button>
        </div>
      ) : null}
      <div className="spell-list">
        {issues.map((it, i) => (
          <div key={`${it.id}-${it.path}-${it.index}-${i}`} className="spell-item">
            <div className="row" style={{ gap: 6 }}>
              <span className="spell-word">{it.word}</span>
              {!only ? <button className="btn btn-sm btn-ghost" title="Show it" onClick={() => api.goTo(it.pi, it.id)}>page {it.pi + 1} ↗</button> : null}
              <div className="grow" />
              <button className="btn btn-sm btn-ghost" title="Add to your dictionary (this browser)" onClick={async () => { await ignoreWord(it.word); setTick((x) => x + 1); }}>Ignore</button>
            </div>
            <div className="row wrap" style={{ gap: 4 }}>
              {it.suggestions.length
                ? it.suggestions.map((s) => <button key={s} className="chip" onClick={() => fix(it, s)}>{s}</button>)
                : <span className="small muted">No suggestions</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
