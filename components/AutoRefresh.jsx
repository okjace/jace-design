'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Keeps a page fresh: reloads its data when you come back to the tab, and every so often while it's open. */
export default function AutoRefresh({ every = 15000 }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const go = () => { if (!document.hidden && Date.now() - last > 2000) { last = Date.now(); router.refresh(); } };
    const t = setInterval(go, every);
    window.addEventListener('focus', go);
    document.addEventListener('visibilitychange', go);
    window.addEventListener('pageshow', go);
    return () => { clearInterval(t); window.removeEventListener('focus', go); document.removeEventListener('visibilitychange', go); window.removeEventListener('pageshow', go); };
  }, [router, every]);
  return null;
}
