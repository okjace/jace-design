import { handler, json, requireUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const PUT = handler(async (request) => {
  const user = await requireUser();
  const body = await request.json();
  const bio = String(body.bio ?? user.bio).slice(0, 300);
  let website = String(body.website ?? user.website).trim().slice(0, 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const emailNotify = typeof body.email_notify === 'boolean' ? body.email_notify : user.email_notify;
  await q('UPDATE users SET bio = $2, website = $3, email_notify = $4, updated_at = NOW() WHERE id = $1', [user.id, bio, website, emailNotify]);
  return json({ ok: true });
});
