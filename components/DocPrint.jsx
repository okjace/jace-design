'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { registerFonts } from '@/lib/fonts';

// Prints a document with its own page size and margins. Choose "Save as PDF" in the print dialog for a PDF.
export default function DocPrint({ id, title, design }) {
  const [ready, setReady] = useState(false);
  const m = design.page?.margin ?? 1;
  useEffect(() => { registerFonts(design).then(() => setReady(true)); }, [design]);
  return (
    <>
      <style>{`@page { size: ${design.width / 96}in ${design.height / 96}in; margin: ${m}in; }
        @media print { .doc-print { box-shadow: none !important; padding: 0 !important; width: auto !important; min-height: 0 !important; } }`}</style>
      <div className="print-toolbar">
        <Link href={`/d/${id}`} className="btn btn-sm">← Back</Link>
        <b className="grow">{title}</b>
        <span className="small muted">Tip: choose “Save as PDF” to get a PDF.</span>
        <button className="btn btn-primary" disabled={!ready} onClick={() => window.print()}>🖨 Print</button>
      </div>
      <div className="print-pages">
        <div className="doc-paper doc-content doc-print" style={{ width: design.width, minHeight: design.height, padding: `${m * 96}px` }} dangerouslySetInnerHTML={{ __html: design.html || '' }} />
      </div>
    </>
  );
}
