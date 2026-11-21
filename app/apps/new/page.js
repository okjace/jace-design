import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import AppForm from '@/components/AppForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Make an app' };

export default async function NewAppPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser().catch(() => null);
  if (!user) redirect('/api/auth/login?next=/apps/new');
  const edit = typeof sp?.edit === 'string' ? sp.edit : null;
  return (
    <main className="page page-narrow" style={{ maxWidth: 640 }}>
      <h1>{edit ? 'Edit your app' : 'Make an app'}</h1>
      <AppForm editId={edit} />
    </main>
  );
}
