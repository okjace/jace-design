'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ShareModal from './ShareModal';
import SaveTemplate from './SaveTemplate';
import { AccessLost, useAccessWatch } from './AccessWatch';
import { useSaver } from './useSaver';
import VersionHistory from './VersionHistory';
import { addr, blankSheet, colName, display, makeEvaluator, parseAddr, parseCSV, toCSV } from '@/lib/sheet';
import { normalizeDesign } from '@/lib/design';
import { downloadBlob, safeName } from '@/lib/export';

const ROW_H = 26;
const DEFAULT_W = 110;
const SWATCH = ['#16181d', '#e40014', '#f99c00', '#fcbb00', '#1f9d5a', '#155dfc', '#7c3aed', '#ffffff'];
const FILLS = ['', '#fef3c7', '#fee2e2', '#e2f4ea', '#dbeafe', '#ede9fe', '#f4f5f7', '#16181d'];

export default function SheetEditor({ id, initialDesign, initialTitle, initialVisibility, role, version }) {
  const [doc, setDoc] = useState(() => normalizeDesign(initialDesign));
  const docRef = useRef(doc);
  docRef.current = doc;
  const [title, setTitle] = useState(initialTitle);
  const titleRef = useRef(title);
  titleRef.current = title;
  const [visibility, setVisibility] = useState(initialVisibility);
  const [si, setSi] = useState(0);
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState(null); // other corner of a range
  const [editing, setEditing] = useState(null); // text being edited in the selected cell
  const [modal, setModal] = useState(null);
  const past = useRef([]);
  const future = useRef([]);
  const timer = useRef(null);
  const saving = useRef(false);
  const again = useRef(false);
  const lockedOut = useRef(false);
  const gridRef = useRef(null);
  const fileRef = useRef(null);
  const { lost, setLost } = useAccessWatch(id, role, () => { lockedOut.current = true; clearTimeout(timer.current); saver.stop(); });

  const sheet = doc.sheets[Math.min(si, doc.sheets.length - 1)];
  const value = useMemo(() => makeEvaluator(sheet), [sheet]);
  const colW = (c) => sheet.colW[colName(c)] || DEFAULT_W;

  // ---------- changes, undo, save ----------
  const commit = useCallback((fn) => {
    const prev = docRef.current;
    const next = fn(prev);
    if (next === prev) return;
    past.current.push(prev);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    docRef.current = next;
    setDoc(next);
  }, []);
  const mapSheet = (d, fn) => ({ ...d, sheets: d.sheets.map((s, i) => (i === si ? fn(s) : s)) });
  const setCells = (patches) => commit((d) => mapSheet(d, (s) => {
    const cells = { ...s.cells };
    for (const [a, patch] of Object.entries(patches)) {
      const next = { ...(cells[a] || {}), ...patch };
      for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null || next[k] === false) delete next[k];
      if (Object.keys(next).length) cells[a] = next; else delete cells[a];
    }
    return { ...s, cells };
  }));
  const undo = () => { if (!past.current.length) return; future.current.push(docRef.current); const d = past.current.pop(); docRef.current = d; setDoc(d); };
  const redo = () => { if (!future.current.length) return; past.current.push(docRef.current); const d = future.current.pop(); docRef.current = d; setDoc(d); };

  // Saving: retries, offline, browser backup and conflict check (see lib/saver.js).
  const saver = useSaver({
    id,
    version,
    getBody: () => ({ design: docRef.current, title: titleRef.current }),
    onLocked: () => { lockedOut.current = true; setLost((c) => c || { reason: 'removed', view: false }); },
    onRestore: (body) => {
      if (body?.design) { const d = normalizeDesign(body.design); docRef.current = d; setDoc(d); }
      if (typeof body?.title === 'string') setTitle(body.title);
    },
  });
  const save = saver.state;
  const doSave = () => saver.now();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!lockedOut.current) saver.changed();
  }, [doc, title]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (new URLSearchParams(location.search).get('share') === '1') setModal('share'); }, []);

  // ---------- selection ----------
  const range = useMemo(() => {
    const a = anchor || sel;
    return { r1: Math.min(a.r, sel.r), r2: Math.max(a.r, sel.r), c1: Math.min(a.c, sel.c), c2: Math.max(a.c, sel.c) };
  }, [anchor, sel]);
  const inRange = (r, c) => r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
  const eachInRange = (fn) => { for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) fn(addr(r, c), r, c); };
  const selAddr = addr(sel.r, sel.c);
  const selCell = sheet.cells[selAddr] || {};

  function move(dr, dc, extend = false) {
    if (extend) { if (!anchor) setAnchor(sel); } else setAnchor(null);
    setSel((s) => ({ r: Math.min(sheet.rows - 1, Math.max(0, s.r + dr)), c: Math.min(sheet.cols - 1, Math.max(0, s.c + dc)) }));
  }
  function commitEdit(next = null) {
    if (editing != null) {
      if ((selCell.v ?? '') !== editing) setCells({ [selAddr]: { v: editing } });
      setEditing(null);
    }
    if (next) move(next[0], next[1]);
    gridRef.current?.focus();
  }
  function formatRange(patch) {
    const p = {};
    eachInRange((a) => { p[a] = typeof patch === 'function' ? patch(sheet.cells[a] || {}) : patch; });
    setCells(p);
  }

  // Keep the selected cell in view.
  useEffect(() => {
    const el = gridRef.current?.querySelector(`[data-a="${selAddr}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selAddr]);

  function onKeyDown(e) {
    if (editing != null) return; // the cell input handles its own keys
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); formatRange({ b: !selCell.b }); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); formatRange({ i: !selCell.i }); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(timer.current); doSave(); return; }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); move(...arrows[e.key], e.shiftKey); return; }
    if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(selCell.v ?? ''); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const p = {}; eachInRange((a) => { p[a] = { v: '' }; }); setCells(p); return; }
    if (e.key.length === 1 && !mod) { e.preventDefault(); setAnchor(null); setEditing(e.key); }
  }

  // ---------- copy / paste (works with Excel / Google Sheets) ----------
  function onCopy(e) {
    if (editing != null) return;
    const rows = [];
    for (let r = range.r1; r <= range.r2; r++) {
      const row = [];
      for (let c = range.c1; c <= range.c2; c++) row.push(display(value(addr(r, c)), sheet.cells[addr(r, c)]?.fmt));
      rows.push(row.join('\t'));
    }
    e.clipboardData.setData('text/plain', rows.join('\n'));
    e.preventDefault();
  }
  function onPaste(e) {
    if (editing != null) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const rows = parseCSV(text.replace(/\r?\n$/, ''));
    const p = {};
    rows.forEach((row, dr) => row.forEach((v, dc) => {
      const r = sel.r + dr, c = sel.c + dc;
      if (r < sheet.rows && c < sheet.cols) p[addr(r, c)] = { v };
    }));
    setCells(p);
  }

  // ---------- columns ----------
  function startResize(e, c) {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = colW(c);
    const mv = (ev) => commitSilently(c, Math.min(600, Math.max(30, w0 + ev.clientX - x0)));
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }
  function commitSilently(c, w) {
    const next = mapSheet(docRef.current, (s) => ({ ...s, colW: { ...s.colW, [colName(c)]: w } }));
    docRef.current = next;
    setDoc(next);
  }

  // ---------- import / export ----------
  async function importCSV(file) {
    const rows = parseCSV(await file.text());
    commit((d) => ({
      ...d,
      sheets: [...d.sheets, {
        ...blankSheet(file.name.replace(/\.\w+$/, '').slice(0, 40)),
        rows: Math.max(100, rows.length + 20),
        cols: Math.min(100, Math.max(26, ...rows.map((r) => r.length))),
        cells: Object.fromEntries(rows.flatMap((row, r) => row.map((v, c) => (v !== '' ? [addr(r, c), { v }] : null)).filter(Boolean))),
      }],
    }));
    setSi(docRef.current.sheets.length - 1);
  }
  function exportCSV() {
    downloadBlob(new Blob([toCSV(sheet, value)], { type: 'text/csv' }), `${safeName(title)}${doc.sheets.length > 1 ? `-${safeName(sheet.name)}` : ''}.csv`);
  }

  const saveLabel = saver.label;
  const shown = editing != null ? editing : selCell.v ?? '';
  const rangeLabel = range.r1 === range.r2 && range.c1 === range.c2 ? selAddr : `${addr(range.r1, range.c1)}:${addr(range.r2, range.c2)}`;
  const stats = useMemo(() => {
    if (range.r1 === range.r2 && range.c1 === range.c2) return null;
    const n = [];
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) { const v = value(addr(r, c)); if (typeof v === 'number') n.push(v); }
    if (!n.length) return null;
    const sum = n.reduce((a, b) => a + b, 0);
    return `Sum ${display(sum)} · Average ${display(sum / n.length)} · Count ${n.length}`;
  }, [range, value]);

  return (
    <div className="doc-editor sheet-editor">
      <div className="ed-top">
        <Link href="/" className="btn btn-sm" title="Home">🏠</Link>
        <button className="btn btn-sm" onClick={undo} title="Undo (Ctrl+Z)">↶</button>
        <button className="btn btn-sm" onClick={redo} title="Redo (Ctrl+Y)">↷</button>
        <input className="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Spreadsheet title" />
        <span className={`ed-status save-${save}`} onClick={() => ['error', 'retrying', 'offline'].includes(save) && saver.retry()}>{saveLabel}</span>
        <button className="btn btn-sm" onClick={() => setModal('history')} title="Version history">🕘</button>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>📥 Import CSV</button>
        <input ref={fileRef} type="file" hidden accept=".csv,.tsv,.txt,text/csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importCSV(f); }} />
        <button className="btn btn-sm" onClick={exportCSV}>⬇ CSV</button>
        <button className="btn btn-sm" onClick={async () => { clearTimeout(timer.current); await doSave(); window.open(`/d/${id}/print`, '_blank'); }}>🖨 Print</button>
        {role === 'owner' ? <button className="btn btn-sm" onClick={async () => { await doSave(); setModal('template'); }}>📌 Template</button> : null}
        <button className="btn btn-sm btn-white" onClick={() => setModal('share')}>🔗 Share</button>
      </div>

      <div className="doc-toolbar">
        <b className="small" style={{ minWidth: 70 }}>{rangeLabel}</b>
        <span className="sep" />
        <button className={`btn btn-sm ${selCell.b ? 'active' : ''}`} onClick={() => formatRange({ b: !selCell.b })} title="Bold (Ctrl+B)"><b>B</b></button>
        <button className={`btn btn-sm ${selCell.i ? 'active' : ''}`} onClick={() => formatRange({ i: !selCell.i })} title="Italic (Ctrl+I)"><i>I</i></button>
        <button className={`btn btn-sm ${selCell.u ? 'active' : ''}`} onClick={() => formatRange({ u: !selCell.u })} title="Underline"><u>U</u></button>
        <span className="sep" />
        <span className="small muted">Text</span>
        {SWATCH.map((c) => <button key={c} className="sheet-swatch" style={{ background: c }} title={c} onClick={() => formatRange({ color: c === '#16181d' ? '' : c })} />)}
        <span className="small muted">Fill</span>
        {FILLS.map((c) => <button key={c || 'none'} className="sheet-swatch" style={{ background: c || 'repeating-linear-gradient(45deg,#fff 0 4px,#e5e7eb 4px 8px)' }} title={c || 'No fill'} onClick={() => formatRange({ bg: c })} />)}
        <span className="sep" />
        {[['left', '⯇'], ['center', '≡'], ['right', '⯈']].map(([a, i]) => (
          <button key={a} className={`btn btn-sm ${selCell.align === a ? 'active' : ''}`} onClick={() => formatRange({ align: a })}>{i}</button>
        ))}
        <select value={selCell.fmt || ''} onChange={(e) => formatRange({ fmt: e.target.value })} title="Number format">
          <option value="">Automatic</option><option value="number">1,234.56</option><option value="currency">$ Currency</option><option value="percent">% Percent</option>
        </select>
        <span className="sep" />
        <button className="btn btn-sm" onClick={() => commit((d) => mapSheet(d, (s) => ({ ...s, rows: Math.min(2000, s.rows + 50) })))}>+ 50 rows</button>
        <button className="btn btn-sm" onClick={() => commit((d) => mapSheet(d, (s) => ({ ...s, cols: Math.min(100, s.cols + 5) })))}>+ 5 columns</button>
      </div>

      <div className="sheet-formula">
        <span className="small muted">ƒx</span>
        <input
          value={shown}
          placeholder="Type a value or a formula like =SUM(A1:A5)"
          onFocus={() => { if (editing == null) setEditing(selCell.v ?? ''); }}
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit([1, 0]); } if (e.key === 'Escape') { setEditing(null); gridRef.current?.focus(); } }}
          onBlur={() => editing != null && commitEdit()}
        />
      </div>

      <div className="sheet-scroll" ref={gridRef} tabIndex={0} onKeyDown={onKeyDown} onCopy={onCopy} onPaste={onPaste}>
        <table className="sheet-grid">
          <thead>
            <tr>
              <th className="corner" />
              {Array.from({ length: sheet.cols }, (_, c) => (
                <th key={c} style={{ width: colW(c), minWidth: colW(c) }} className={c >= range.c1 && c <= range.c2 ? 'hl' : ''}>
                  {colName(c)}
                  <span className="col-resize" onPointerDown={(e) => startResize(e, c)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => (
              <tr key={r} style={{ height: ROW_H }}>
                <th className={r >= range.r1 && r <= range.r2 ? 'hl' : ''}>{r + 1}</th>
                {Array.from({ length: sheet.cols }, (_, c) => {
                  const a = addr(r, c);
                  const cell = sheet.cells[a];
                  const isSel = r === sel.r && c === sel.c;
                  const v = cell?.v != null ? value(a) : '';
                  const err = typeof v === 'string' && v.startsWith('#') && (v.endsWith('!') || v.endsWith('?'));
                  return (
                    <td
                      key={c}
                      data-a={a}
                      className={`${isSel ? 'sel' : inRange(r, c) ? 'inrange' : ''}`}
                      style={{
                        fontWeight: cell?.b ? 700 : undefined, fontStyle: cell?.i ? 'italic' : undefined, textDecoration: cell?.u ? 'underline' : undefined,
                        color: err ? '#e40014' : cell?.color, background: cell?.bg || undefined,
                        textAlign: cell?.align || (typeof v === 'number' ? 'right' : 'left'),
                      }}
                      onPointerDown={(e) => {
                        if (editing != null && !isSel) commitEdit();
                        if (e.shiftKey) { if (!anchor) setAnchor(sel); setSel({ r, c }); return; }
                        setAnchor(null); setSel({ r, c });
                        const start = { r, c };
                        const over = (ev) => {
                          const td = ev.target.closest?.('td[data-a]');
                          const p = td && parseAddr(td.dataset.a);
                          if (p) { setAnchor(start); setSel(p); }
                        };
                        const up = () => { window.removeEventListener('pointerover', over); window.removeEventListener('pointerup', up); };
                        window.addEventListener('pointerover', over);
                        window.addEventListener('pointerup', up);
                      }}
                      onDoubleClick={() => setEditing(cell?.v ?? '')}
                    >
                      {isSel && editing != null ? (
                        <input
                          className="cell-input"
                          autoFocus
                          value={editing}
                          onChange={(e) => setEditing(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit([e.shiftKey ? -1 : 1, 0]); }
                            else if (e.key === 'Tab') { e.preventDefault(); commitEdit([0, e.shiftKey ? -1 : 1]); }
                            else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); gridRef.current?.focus(); }
                          }}
                          onBlur={() => commitEdit()}
                        />
                      ) : display(v, cell?.fmt)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="doc-status sheet-tabs">
        {doc.sheets.map((s, i) => (
          <button key={s.id} className={`sheet-tab ${i === si ? 'on' : ''}`} onClick={() => { setSi(i); setSel({ r: 0, c: 0 }); setAnchor(null); setEditing(null); }}
            onDoubleClick={() => { const n = prompt('Rename sheet', s.name); if (n) commit((d) => ({ ...d, sheets: d.sheets.map((x, j) => (j === i ? { ...x, name: n.slice(0, 40) } : x)) })); }}>
            {s.name}
          </button>
        ))}
        <button className="sheet-tab" title="Add a sheet" onClick={() => { commit((d) => ({ ...d, sheets: [...d.sheets, blankSheet(`Sheet ${d.sheets.length + 1}`)] })); setSi(doc.sheets.length); }}>＋</button>
        {doc.sheets.length > 1 ? (
          <button className="sheet-tab" title="Delete this sheet" onClick={() => { if (confirm(`Delete "${sheet.name}"?`)) { commit((d) => ({ ...d, sheets: d.sheets.filter((_, j) => j !== si) })); setSi(0); } }}>🗑</button>
        ) : null}
        <span className="grow" />
        {stats ? <span>{stats}</span> : <span className="muted">Double-click a tab to rename it</span>}
      </div>

      {modal === 'share' ? <ShareModal id={id} title={title} role={role} visibility={visibility} onVisibility={async (v) => { setVisibility(v); await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) }); }} onClose={() => setModal(null)} /> : null}
      {modal === 'template' ? <SaveTemplate id={id} title={title} onClose={() => setModal(null)} /> : null}
      <AccessLost id={id} lost={lost} />
      {saver.notices}
      {modal === 'history' ? <VersionHistory id={id} beforeSave={() => doSave()} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
