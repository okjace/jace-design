import { NextResponse } from 'next/server';
import { encrypt, originOf, sessionCookie, verify } from '@/lib/auth';
import { exchangeCode, userinfo } from '@/lib/jace';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const origin = originOf(request);
  const saved = verify(request.cookies.get('jd_oauth')?.value);
  const next = saved?.next || '/';
  const fail = (code) => {
    const res = NextResponse.redirect(saved?.silent ? `${origin}${next}` : `${origin}/?error=${encodeURIComponent(code)}`);
    res.cookies.delete('jd_oauth');
    return res;
  };

  if (url.searchParams.get('error')) return fail(url.searchParams.get('error'));
  const code = url.searchParams.get('code');
  if (!saved || !code || url.searchParams.get('state') !== saved.state) return fail('bad_state');

  try {
    const token = await exchangeCode({ code, redirectUri: `${origin}/api/auth/callback` });
    const info = await userinfo(token.access_token);
    if (info.banned) return fail('banned');
    await q(
      `INSERT INTO users (id, username, name, picture) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name,
         picture = EXCLUDED.picture, updated_at = NOW()`,
      [String(info.sub), info.username, info.name || info.username, info.picture || null]
    );
    // Keep the access token (encrypted) so Jace Design can send Jace Social messages when you share.
    const scope = String(token.scope || '');
    const expires = new Date(Date.now() + (Number(token.expires_in) || 3600) * 1000);
    await q('UPDATE users SET access_token = $2, token_expires = $3, token_scope = $4 WHERE id = $1',
      [String(info.sub), encrypt(token.access_token), expires, scope]);
    const res = NextResponse.redirect(`${origin}${next}`);
    const c = sessionCookie(String(info.sub));
    res.cookies.set(c.name, c.value, c.options);
    res.cookies.delete('jd_oauth');
    return res;
  } catch (e) {
    console.error('Jace sign-in failed', e);
    return fail('signin_failed');
  }
}
