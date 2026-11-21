'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// 🔔 in the top bar with the number of unread inbox items.
export default function InboxBell() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      fetch('/api/inbox?count=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setN(d.unread)).catch(() => {});
    };
    load();
    const t = setInterval(load, 20000);
    const onUpdate = (e) => setN(Number(e.detail) || 0);
    const onVis = () => { if (!document.hidden) load(); };
    window.addEventListener('jd-inbox', onUpdate);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); window.removeEventListener('jd-inbox', onUpdate); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return (
    <Link href="/inbox" className="inbox-bell" title={n ? `${n} new in your inbox` : 'Inbox'} aria-label="Inbox">
      🔔{n ? <span className="inbox-count">{n > 99 ? '99+' : n}</span> : null}
    </Link>
  );
}
