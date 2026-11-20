'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { blankDesign } from '@/lib/design';

export function useCreate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createFrom(title, design) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, design }) });
      if (res.status === 401) { location.href = `/api/auth/login?next=${encodeURIComponent(location.pathname)}`; return; }
      if (res.status === 413) throw new Error('That file is too big. Try smaller images.');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create design');
      router.push(`/design/${data.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  const create = ({ title, w, h, pages = 1 }) => createFrom(title || 'Untitled design', blankDesign(w, h, pages));
  return { create, createFrom, busy, error };
}
