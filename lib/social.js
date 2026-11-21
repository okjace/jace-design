import 'server-only';
import { decrypt } from './auth';
import { JACE } from './jace';

/** The signed-in person's Jace token, if it can send messages. Otherwise a reason. */
export function socialToken(user) {
  if (!user?.access_token) return { reason: 'connect' };
  if (user.token_expires && new Date(user.token_expires) < new Date()) return { reason: 'expired' };
  if (user.token_scope && !user.token_scope.split(/\s+/).includes('messages')) return { reason: 'connect' };
  const token = decrypt(user.access_token);
  return token ? { token } : { reason: 'connect' };
}

export async function jaceApi(token, path, init = {}) {
  const res = await fetch(`${JACE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
