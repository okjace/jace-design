import 'server-only';
import { one } from './db';

export const JACE = 'https://jaceo.vercel.app';
export const clientId = () => process.env.JACE_CLIENT_ID || '';
export const clientSecret = () => process.env.JACE_CLIENT_SECRET || '';

export function authorizeUrl({ redirectUri, state, prompt, scope = 'profile email' }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri,
    scope,
    state,
  });
  if (prompt) p.set('prompt', prompt);
  return `${JACE}/oauth/authorize?${p}`;
}

export async function exchangeCode({ code, redirectUri }) {
  const res = await fetch(`${JACE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || `token ${res.status}`);
  return data;
}

export async function userinfo(accessToken) {
  const res = await fetch(`${JACE}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`userinfo ${res.status}`);
  return res.json();
}

/**
 * Email a Jace user from Jace's address (official apps only).
 * Uses the app's client credentials, so it works for anyone who has signed in to Jace Design.
 * Respects the user's own "email me" setting in Jace Design as well as Jace's.
 */
export async function emailUser(userId, { subject, message, heading, button_label, button_url }) {
  try {
    if (!clientId() || !clientSecret()) return { sent: false, reason: 'not_configured' };
    const u = await one('SELECT email_notify FROM users WHERE id = $1', [userId]);
    if (!u || !u.email_notify) return { sent: false, reason: 'opted_out' };
    const body = {
      user_id: userId,
      subject: String(subject).slice(0, 150),
      message: String(message).slice(0, 5000),
    };
    if (heading) body.heading = String(heading).slice(0, 150);
    if (button_url && button_url.startsWith('https://')) {
      body.button_url = button_url;
      body.button_label = String(button_label || 'Open').slice(0, 40);
    }
    const res = await fetch(`${JACE}/api/oauth/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.warn('Jace email failed', res.status, data);
    return data;
  } catch (e) {
    console.warn('Jace email error', e);
    return { sent: false, reason: 'error' };
  }
}
