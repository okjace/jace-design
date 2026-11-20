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
  const silent = false;
  const origin = originOf(request);
  if (!clientId()) {
    return NextResponse.redirect(`${origin}/?error=not_configured`);
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const redirectUri = `${origin}/api/auth/callback`;
  const res = NextResponse.redirect(authorizeUrl({ redirectUri, state }));
  res.cookies.set('jd_oauth', sign({ state, next, silent, exp: Math.floor(Date.now() / 1000) + 600 }), {
    httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 600,
  });
  return res;
}
