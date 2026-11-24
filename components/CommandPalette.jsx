'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Ctrl/⌘ + K: type to find any action and press Enter.
 * commands: [{ id, label, group, keys?, run, hint? }]
 */
export default function CommandPalette({ commands, onClose }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const listRef = useRef(null);
  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.group} ${c.hint || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 60);
  }, [q, commands]);
  useEffect(() => setAt(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }, [at]);

  const run = (c) => { onClose(); setTimeout(() => c.run(), 0); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((x) => Math.min(found.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (found[at]) run(found[at]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  let lastGroup = '';
  return (
    <div className="modal-back palette-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette">
        <input className="palette-input" autoFocus placeholder="Type a command… (add text, next page, download PDF, present…)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        <div className="palette-list" ref={listRef}>
          {!found.length ? <div className="small muted" style={{ padding: 14 }}>Nothing matches “{q}”.</div> : found.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {head ? <div className="palette-group">{head}</div> : null}
                <button className={`palette-item ${i === at ? 'active' : ''}`} onMouseEnter={() => setAt(i)} onClick={() => run(c)}>
                  <span className="grow">{c.label}</span>
                  {c.keys ? <kbd>{c.keys}</kbd> : null}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot small muted">↑↓ to move · Enter to run · Esc to close</div>
      </div>
    </div>
  );
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
export const SHORTCUTS = [
  ['Anywhere', [
    [`${MOD} + K`, 'Command palette (find any action)'], ['?', 'This list of shortcuts'], [`${MOD} + S`, 'Save now'],
    [`${MOD} + Z`, 'Undo'], [`${MOD} + Shift + Z  /  ${MOD} + Y`, 'Redo'], ['Esc', 'Unselect, stop the pen, close'],
  ]],
  ['Selected things', [
    ['Delete / Backspace', 'Delete'], [`${MOD} + D`, 'Duplicate'], [`${MOD} + C / X / V`, 'Copy / cut / paste'],
    ['Arrow keys', 'Move 1 px (Shift: 10 px)'], ['Enter', 'Edit the selected text'], [`${MOD} + ] / [`, 'Forward / backward'],
    [`${MOD} + Shift + ] / [`, 'To front / to back'], [`${MOD} + G`, 'Group'], [`${MOD} + Shift + G`, 'Ungroup'],
    [`${MOD} + A`, 'Select everything on the page'], ['Shift + click', 'Add to / remove from the selection'],
    [`${MOD} + click`, 'Pick one thing inside a group'], ['Alt while dragging', 'No snapping'],
  ]],
  ['View', [
    [`${MOD} + scroll`, 'Zoom'], ['R', 'Rulers on / off'], ["'", 'Grid on / off'], ['Drag from a ruler', 'Make a guide line (drag it back to remove)'],
  ]],
  ['Video', [['Space', 'Play / pause on the timeline']]],
];

export function ShortcutsModal({ onClose }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(640px, 100%)' }}>
        <div className="modal-head"><h3>⌨️ Keyboard shortcuts</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {SHORTCUTS.map(([group, list]) => (
            <div key={group}>
              <h4 style={{ margin: '0 0 6px' }}>{group}</h4>
              <table className="doc-table"><tbody>
                {list.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}
              </tbody></table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
