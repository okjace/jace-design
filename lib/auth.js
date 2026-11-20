import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { one } from './db';

export const SESSION_COOKIE = 'jd_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET || process.env.JACE_CLIENT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set');
    return 'dev-only-insecure-secret';
  }
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(userId) {
  return {
    name: SESSION_COOKIE,
    value: sign({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE }),
    options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE },
  };
}

/** The signed-in user (row from `users`), or null. */
export async function getUser() {
  const store = await cookies();
  const data = verify(store.get(SESSION_COOKIE)?.value);
  if (!data?.uid) return null;
  return one('SELECT * FROM users WHERE id = $1', [data.uid]);
}

/** Public base URL of the site. */
export async function siteUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function originOf(request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
  return `${proto}://${host}`;
}

export function newId(len = 12) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw Object.assign(new Error('Sign in required'), { status: 401 });
  return user;
}

/** Wrap a route handler so thrown {status} errors become JSON responses. */
export function handler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e?.status) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong' }, 500);
    }
  };
}
