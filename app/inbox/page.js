import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { inboxItems } from '@/lib/notify';
import InboxList from '@/components/InboxList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inbox' };

export default async function InboxPage() {
  const user = await getUser();
  if (!user) redirect('/api/auth/login?next=/inbox');
  const items = await inboxItems(user.id);
  return (
    <main className="page page-narrow">
      <h1>Inbox</h1>
      <p className="muted">Designs shared with your Jace username, access requests, comments, remixes and new followers.</p>
      <InboxList initial={items.map((n) => ({ ...n, created_at: new Date(n.created_at).toISOString(), read_at: n.read_at ? new Date(n.read_at).toISOString() : null }))} />
    </main>
  );
}
