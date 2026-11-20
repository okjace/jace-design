import { NextResponse } from 'next/server';
import { originOf, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request) {
  const res = NextResponse.redirect(`${originOf(request)}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  // Don't immediately silent-sign them back in.
  res.cookies.set('jd_silent', '1', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
