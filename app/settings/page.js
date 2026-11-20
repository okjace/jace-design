import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { clientId } from '@/lib/jace';
import SettingsForm from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function Settings() {
  const user = await getUser();
  if (!user) redirect('/api/auth/login?next=/settings');
  return (
    <main className="page page-narrow">
      <h1>Settings</h1>
      <p className="muted">Your name, username and picture come from your Jace account and update each time you sign in.</p>
      <SettingsForm user={{ username: user.username, name: user.name, picture: user.picture, bio: user.bio, website: user.website, email_notify: user.email_notify }} configured={!!clientId()} />
    </main>
  );
}
