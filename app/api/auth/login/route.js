import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { originOf, sign } from '@/lib/auth';
import { authorizeUrl, clientId } from '@/lib/jace';

export const dynamic = 'force-dynamic';

function safeNext(n) {
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export async function GET(request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const silent = url.searchParams.get('silent') === '1';
  const origin = originOf(request);
  if (!clientId()) {
    const res = NextResponse.redirect(silent ? `${origin}${next}` : `${origin}/?error=not_configured`);
    res.cookies.set('jd_silent', '1', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
    return res;
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const redirectUri = `${origin}/api/auth/callback`;
  const res = NextResponse.redirect(authorizeUrl({ redirectUri, state, prompt: silent ? 'none' : undefined }));
  res.cookies.set('jd_oauth', sign({ state, next, silent, exp: Math.floor(Date.now() / 1000) + 600 }), {
    httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 600,
  });
  if (silent) {
    // Only try silent sign-in once a day, so signed-out visitors aren't bounced around.
    res.cookies.set('jd_silent', '1', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
  }
  return res;
}
