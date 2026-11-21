'use client';
import { useEffect, useState } from 'react';

// Jace's READ ME forum holds the Terms of Service and Privacy Policy.
const FORUM = 'https://jaceo.vercel.app/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347';
export const TERMS_URL = `${FORUM}/7a9f0277-e85e-44f2-91da-353a1b3b3451`;
export const PRIVACY_URL = `${FORUM}/3e462dc4-1734-400a-8ca6-66a80ff32ac7`;
const KEY = 'jd_terms_notice_seen';

/** A small corner notice, shown once: it goes away by itself after about 5 seconds and doesn't come back. */
export default function TermsNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch {}
    if (seen) return undefined;
    setShow(true);
    try { localStorage.setItem(KEY, '1'); } catch {}
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <a className="terms-notice" href={FORUM} target="_blank" rel="noopener noreferrer" onClick={() => setShow(false)}>
      By using this app, you agree to the Terms of Service and Privacy Policy.
    </a>
  );
}

/** The line for screens where someone makes an account (or gives a name to join as a guest). */
export function AccountTerms() {
  return (
    <p className="small muted" style={{ margin: 0 }}>
      By making an account, you agree to the{' '}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Terms of Service</a> and{' '}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
    </p>
  );
}
