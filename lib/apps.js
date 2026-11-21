import 'server-only';

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\])/i;

/** Check what someone typed in for their app. Returns { app } or { error }. */
export function cleanApp(b = {}) {
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (name.length < 2) return { error: 'Give your app a name.' };
  let url;
  try { url = new URL(String(b.url || '').trim()); } catch { return { error: 'The app’s address must be a full link, like https://example.com/my-app' }; }
  if (url.protocol !== 'https:') return { error: 'The app must be on an https:// address.' };
  if (BLOCKED_HOSTS.test(url.hostname)) return { error: 'That address can’t be used for an app.' };
  // One emoji or a couple of letters as the icon.
  const icon = [...String(b.icon || '🧩').trim()].slice(0, 2).join('') || '🧩';
  return {
    app: {
      name,
      description: String(b.description || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      icon,
      url: url.toString().slice(0, 500),
      public: b.public !== false,
    },
  };
}
