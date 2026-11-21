'use client';
import Link from 'next/link';
import SheetView from './SheetView';

// Prints every sheet as a table (landscape works best for wide sheets).
export default function SheetPrint({ id, title, design }) {
  return (
    <>
      <style>{'@page { margin: 12mm; } @media print { .sheet-grid th { background: #f4f5f7 !important; } }'}</style>
      <div className="print-toolbar">
        <Link href={`/d/${id}`} className="btn btn-sm">← Back</Link>
        <b className="grow">{title}</b>
        <span className="small muted">Tip: choose “Landscape” for wide sheets, or “Save as PDF”.</span>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
      </div>
      <div style={{ padding: 20, background: '#fff', color: '#16181d' }}>
        <SheetView design={design} all />
      </div>
    </>
  );
}
