import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import CreateHub from '@/components/CreateHub';

export const metadata = { title: 'Create a design' };
export const dynamic = 'force-dynamic';

export default async function NewPage() {
  const user = await getUser();
  if (!user) redirect('/api/auth/login?next=/new');
  return <CreateHub />;
}
