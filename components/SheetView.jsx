'use client';
import { useMemo, useState } from 'react';
import { addr, colName, display, makeEvaluator, parseAddr } from '@/lib/sheet';

/** Read-only spreadsheet (for the share page, embeds and printing): only the used area is shown. */
export default function SheetView({ design, all = false, maxHeight = '70vh' }) {
  const [si, setSi] = useState(0);
  const sheets = design.sheets || [];
  const list = all ? sheets : [sheets[Math.min(si, sheets.length - 1)]].filter(Boolean);
  return (
    <div className="sheet-view">
      {!all && sheets.length > 1 ? (
        <div className="row wrap" style={{ gap: 4, marginBottom: 8 }}>
          {sheets.map((s, i) => <button key={s.id} className={`sheet-tab ${i === si ? 'on' : ''}`} onClick={() => setSi(i)}>{s.name}</button>)}
        </div>
      ) : null}
      {list.map((s) => <OneSheet key={s.id} sheet={s} title={all && sheets.length > 1 ? s.name : null} maxHeight={all ? 'none' : maxHeight} />)}
    </div>
  );
}

function OneSheet({ sheet, title, maxHeight }) {
  const value = useMemo(() => makeEvaluator(sheet), [sheet]);
  let maxR = 0, maxC = 0;
  for (const k of Object.keys(sheet.cells || {})) { const p = parseAddr(k); if (p) { maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); } }
  const rows = Math.max(5, maxR + 1), cols = Math.max(3, maxC + 1);
  return (
    <div style={{ marginBottom: 16 }}>
      {title ? <h3 style={{ margin: '0 0 6px' }}>{title}</h3> : null}
      <div style={{ overflow: 'auto', maxHeight, border: '1px solid #dfe2e7', borderRadius: 8, background: '#fff' }}>
        <table className="sheet-grid readonly">
          <thead><tr><th className="corner" />{Array.from({ length: cols }, (_, c) => <th key={c} style={{ minWidth: sheet.colW?.[colName(c)] || 100 }}>{colName(c)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const a = addr(r, c);
                  const cell = sheet.cells?.[a];
                  const v = cell?.v != null ? value(a) : '';
                  return (
                    <td key={c} style={{ fontWeight: cell?.b ? 700 : undefined, fontStyle: cell?.i ? 'italic' : undefined, textDecoration: cell?.u ? 'underline' : undefined,
                      color: cell?.color, background: cell?.bg || undefined, textAlign: cell?.align || (typeof v === 'number' ? 'right' : 'left') }}>
                      {display(v, cell?.fmt)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
