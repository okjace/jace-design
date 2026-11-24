'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { blankDesign } from '@/lib/design';
import { externalize } from '@/lib/blobs';

export function useCreate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createFrom(title, design) {
    setBusy(true);
    setError('');
    try {
      // Pictures and fonts go up on their own first, so the design itself stays small (any size works).
      const { value } = await externalize(design);
      const res = await fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, design: value }) });
      if (res.status === 401) { location.href = `/api/auth/login?next=${encodeURIComponent(location.pathname)}`; return; }
      if (res.status === 413) throw new Error('Could not create it in one go. Try again.');
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
