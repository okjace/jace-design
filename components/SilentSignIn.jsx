'use client';
import { useEffect } from 'react';

// People using Jace Browser are already signed in to Jace, so try a silent sign-in once a day.
export default function SilentSignIn() {
  useEffect(() => {
    if (document.cookie.split('; ').some((c) => c.startsWith('jd_silent='))) return;
    if (location.pathname.startsWith('/api/') || location.pathname.endsWith('/embed') || window.self !== window.top) return;
    const next = location.pathname + location.search;
    location.replace(`/api/auth/login?silent=1&next=${encodeURIComponent(next)}`);
  }, []);
  return null;
}
