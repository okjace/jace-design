import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { loadDesign } from '@/lib/access';
import PrintView from '@/components/PrintView';
import DocPrint from '@/components/DocPrint';
import SheetPrint from '@/components/SheetPrint';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print' };

export default async function PrintPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role, perms, needsName } = await loadDesign(id, user);
  if (!design) notFound();
  if (!role || needsName) redirect(`/d/${id}`);
  if (!perms.print) notFound();
  if (design.data?.kind === 'doc') return <DocPrint id={id} title={design.title} design={design.data} />;
  if (design.data?.kind === 'sheet') return <SheetPrint id={id} title={design.title} design={design.data} />;
  return <PrintView id={id} title={design.title} design={design.data} />;
}
