'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// 🔔 in the top bar with the number of unread inbox items.
// It keeps a live connection to the server, so new invites and activity show up within about a second.
// Other parts of the page (like the inbox list) listen for the 'jd-inbox-changed' event.
export default function InboxBell() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let es = null;
    let fallback = null;
    const load = () => fetch('/api/inbox?count=1', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setN(d.unread)).catch(() => {});

    const connect = () => {
      if (es || typeof EventSource === 'undefined') return;
      es = new EventSource('/api/inbox/stream');
      es.addEventListener('inbox', (e) => {
        try {
          const d = JSON.parse(e.data);
          setN(d.unread);
          if (d.changed) window.dispatchEvent(new CustomEvent('jd-inbox-changed', { detail: d.unread }));
        } catch {}
      });
      // The browser reconnects on its own after the server closes the stream (about once a minute).
    };
    const disconnect = () => { if (es) { es.close(); es = null; } };

    load();
    connect();
    // Safety net in case live updates are blocked (some networks or browser extensions).
    fallback = setInterval(() => { if (!document.hidden) load(); }, 60000);
    const onUpdate = (e) => setN(Number(e.detail) || 0);
    // Pause the live connection while the tab is hidden, and catch up the moment it's visible again.
    const onVis = () => {
      if (document.hidden) disconnect();
      else { load(); connect(); window.dispatchEvent(new CustomEvent('jd-inbox-changed')); }
    };
    window.addEventListener('jd-inbox', onUpdate);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      disconnect();
      clearInterval(fallback);
      window.removeEventListener('jd-inbox', onUpdate);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return (
    <Link href="/inbox" className="inbox-bell" title={n ? `${n} new in your inbox` : 'Inbox'} aria-label="Inbox">
      🔔{n ? <span className="inbox-count">{n > 99 ? '99+' : n}</span> : null}
    </Link>
  );
}
