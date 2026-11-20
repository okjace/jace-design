import { NextResponse } from 'next/server';
import { originOf, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request) {
  const res = NextResponse.redirect(`${originOf(request)}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
