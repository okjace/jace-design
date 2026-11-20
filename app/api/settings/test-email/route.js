import { handler, json, requireUser, siteUrl } from '@/lib/auth';
import { JACE, clientId, clientSecret } from '@/lib/jace';

// Sends the signed-in person a test email through Jace (ignores the in-app notification toggle,
// since they asked for it). Returns Jace's answer so the settings page can explain it.
export const POST = handler(async () => {
  const user = await requireUser();
  if (!clientId() || !clientSecret()) return json({ sent: false, reason: 'not_configured' });
  const base = await siteUrl();
  const res = await fetch(`${JACE}/api/oauth/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body: JSON.stringify({
      user_id: user.id,
      subject: 'Test email from Jace Design',
      heading: 'It works! 🎨',
      message: `Hi ${user.name || user.username},\n\nThis is a test email from Jace Design. If you're reading this, emails are set up correctly.\n\nYou'll get emails like this when someone comments on, remixes or shares a design with you, or follows you. You can turn them off any time in Settings.`,
      button_label: 'Open Jace Design',
      button_url: base.startsWith('https://') ? base : 'https://jaceo.vercel.app',
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ sent: false, reason: data.error || `http_${res.status}`, detail: data.error_description }, 200);
  return json(data);
});
