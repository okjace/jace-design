'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DesignPage from './DesignPage';
import { ensureFonts } from '@/lib/export';

const PX_PER_MM = 96 / 25.4;
const PAPERS = {
  design: { name: 'Same as design', w: null, h: null },
  a4: { name: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  a5: { name: 'A5 (148 × 210 mm)', w: 148, h: 210 },
  a3: { name: 'A3 (297 × 420 mm)', w: 297, h: 420 },
  letter: { name: 'Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
  legal: { name: 'Legal (8.5 × 14 in)', w: 215.9, h: 355.6 },
  tabloid: { name: 'Tabloid (11 × 17 in)', w: 279.4, h: 431.8 },
  photo4x6: { name: 'Photo (4 × 6 in)', w: 101.6, h: 152.4 },
};

function parseRange(str, n) {
  if (!str.trim()) return [...Array(n).keys()];
  const out = new Set();
  for (const part of str.split(',')) {
    const [a, b] = part.split('-').map((x) => parseInt(x, 10));
    if (Number.isFinite(a)) for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) if (i >= 1 && i <= n) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

export default function PrintView({ id, title, design }) {
  const [paper, setPaper] = useState('design');
  const [orient, setOrient] = useState('auto');
  const [margin, setMargin] = useState(0);
  const [crop, setCrop] = useState(false);
  const [fitMode, setFitMode] = useState('fit');
  const [range, setRange] = useState('');
  const [copies, setCopies] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => { ensureFonts(design).then(() => setReady(true)); }, [design]);

  const designMm = { w: design.width / PX_PER_MM, h: design.height / PX_PER_MM };
  const sheet = useMemo(() => {
    if (paper === 'design') return { w: designMm.w + margin * 2, h: designMm.h + margin * 2 };
    let { w, h } = PAPERS[paper];
    const landscape = orient === 'landscape' || (orient === 'auto' && design.width > design.height);
    if (landscape) [w, h] = [h, w];
    return { w, h };
  }, [paper, orient, margin, design.width, design.height, designMm.w, designMm.h]);

  const area = { w: sheet.w - margin * 2, h: sheet.h - margin * 2 };
  const s = fitMode === 'actual' ? 1 : Math.min(area.w / designMm.w, area.h / designMm.h);
  const art = { w: designMm.w * s, h: designMm.h * s };
  const pages = parseRange(range, design.pages.length);
  const list = [];
  for (const p of pages) for (let c = 0; c < Math.max(1, Math.min(50, copies)); c++) list.push(p);
  const screenScale = Math.min(1, 700 / (sheet.w * PX_PER_MM));

  const markLen = 5;
  const left = (sheet.w - art.w) / 2;
  const top = (sheet.h - art.h) / 2;

  return (
    <>
      <style>{`@page { size: ${sheet.w}mm ${sheet.h}mm; margin: 0; } @media print { .print-sheet { transform: none !important; margin: 0 !important; } }`}</style>
      <div className="print-toolbar">
        <Link href={`/d/${id}`} className="btn btn-sm">← Back</Link>
        <b className="grow">{title}</b>
        <label className="row small">Paper
          <select className="input" style={{ width: 190 }} value={paper} onChange={(e) => setPaper(e.target.value)}>
            {Object.entries(PAPERS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </label>
        {paper !== 'design' ? (
          <>
            <label className="row small">Orientation
              <select className="input" style={{ width: 120 }} value={orient} onChange={(e) => setOrient(e.target.value)}>
                <option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select>
            </label>
            <label className="row small">Size
              <select className="input" style={{ width: 130 }} value={fitMode} onChange={(e) => setFitMode(e.target.value)}>
                <option value="fit">Fit to page</option><option value="actual">Actual size</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="row small">Margin (mm)<input className="input" type="number" min="0" max="50" style={{ width: 70 }} value={margin} onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="row small">Pages<input className="input" placeholder={`1-${design.pages.length}`} style={{ width: 90 }} value={range} onChange={(e) => setRange(e.target.value)} /></label>
        <label className="row small">Copies<input className="input" type="number" min="1" max="50" style={{ width: 64 }} value={copies} onChange={(e) => setCopies(Number(e.target.value) || 1)} /></label>
        <label className="row small"><input type="checkbox" checked={crop} onChange={(e) => setCrop(e.target.checked)} /> Crop marks</label>
        <button className="btn btn-primary" disabled={!ready} onClick={() => window.print()}>🖨 Print</button>
      </div>
      <div className="print-pages">
        {list.map((pi, n) => (
          <div key={n} className="print-sheet" style={{ width: `${sheet.w}mm`, height: `${sheet.h}mm`, transform: `scale(${screenScale})`, transformOrigin: 'top center', marginBottom: `calc(${sheet.h}mm * ${screenScale - 1})` }}>
            <div style={{ position: 'absolute', left: `${left}mm`, top: `${top}mm`, width: `${art.w}mm`, height: `${art.h}mm`, overflow: 'hidden' }}>
              <DesignPage design={design} page={design.pages[pi]} width="100%" height="100%" uidPrefix={`pr${n}-`} />
            </div>
            {crop && margin >= 3 ? [
              [left, top, -1, -1], [left + art.w, top, 1, -1], [left, top + art.h, -1, 1], [left + art.w, top + art.h, 1, 1],
            ].map(([x, y, dx, dy], j) => (
              <span key={j}>
                <span className="crop" style={{ left: `${dx < 0 ? x - markLen - 1 : x + 1}mm`, top: `${y}mm`, width: `${markLen}mm`, height: '0.2mm' }} />
                <span className="crop" style={{ left: `${x}mm`, top: `${dy < 0 ? y - markLen - 1 : y + 1}mm`, width: '0.2mm', height: `${markLen}mm` }} />
              </span>
            )) : null}
          </div>
        ))}
      </div>
      {crop && margin < 3 ? <p className="center small muted no-print">Add a margin of at least 3 mm to see crop marks.</p> : null}
    </>
  );
}
