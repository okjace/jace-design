import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { handler } from '@/lib/auth';
import { getGuest, guestCookie } from '@/lib/access';

// People without a Jace account tell us their name before they can view or comment.
export const POST = handler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (name.length < 2) return NextResponse.json({ error: 'Please enter your name (at least 2 letters).' }, { status: 400 });
  const existing = await getGuest();
  const token = existing?.token || crypto.randomBytes(18).toString('base64url');
  const res = NextResponse.json({ ok: true, name });
  const c = guestCookie(token, name);
  res.cookies.set(c.name, c.value, c.options);
  return res;
});
