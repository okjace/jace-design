import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { loadDesign } from '@/lib/access';
import PrintView from '@/components/PrintView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print' };

export default async function PrintPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) notFound();
  return <PrintView id={id} title={design.title} design={design.data} />;
}
