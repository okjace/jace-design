'use client';
import { useEffect, useState } from 'react';
import DesignPage from './DesignPage';
import DocPaper from './DocPaper';
import { registerFonts } from '@/lib/fonts';

export default function EmbedView({ id, title, design }) {
  const [i, setI] = useState(0);
  const [, setReady] = useState(0);
  const isDoc = design.kind === 'doc';
  const n = isDoc ? 1 : design.pages.length;
  useEffect(() => { registerFonts(design).then(() => setReady((x) => x + 1)); }, [design]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#111', display: 'flex', flexDirection: 'column' }}>
      {isDoc ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16 }}>
          <DocPaper design={design} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
          onClick={() => setI((x) => (x + 1) % n)}>
          <DesignPage design={design} page={design.pages[i]} width="100%" height="100%" uidPrefix="em-" />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', color: '#ddd', fontSize: 13, background: '#000' }}>
        <a href={`/d/${id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{title}</a>
        <span style={{ marginLeft: 'auto' }}>{n > 1 ? `${i + 1} / ${n}` : ''}</span>
        <a href="/" target="_blank" rel="noreferrer" style={{ opacity: 0.7 }}>Made with Jace Design</a>
      </div>
    </div>
  );
}
