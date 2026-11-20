'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

export default function DesignSearch({ initial = '', placeholder = 'Search your designs' }) {
  const router = useRouter();
  const path = usePathname();
  const [v, setV] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); router.push(v ? `${path}?q=${encodeURIComponent(v)}` : path); }}>
      <input className="input" style={{ width: 260 }} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
    </form>
  );
}
