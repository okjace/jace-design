'use client';
import Link from 'next/link';
import { useCreate } from './useCreate';

export default function QuickCreate({ presets }) {
  const { create, busy } = useCreate();
  return (
    <div className="row wrap" style={{ marginTop: 20, gap: 10 }}>
      {presets.map((p) => (
        <button key={p.name} className="btn" disabled={busy} style={{ background: 'rgba(255,255,255,.16)', color: '#fff', border: 0 }}
          onClick={() => create({ title: p.name, w: p.w, h: p.h, pages: p.pages })}>
          <span>{p.icon}</span> {p.name}
        </button>
      ))}
      <Link href="/new" className="btn" style={{ background: '#fff', color: '#157a47', border: 0 }}>More: templates, imports, custom size →</Link>
    </div>
  );
}
