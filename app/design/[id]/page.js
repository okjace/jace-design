import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { canEdit, loadDesign } from '@/lib/access';
import Editor from '@/components/Editor';
import DocEditor from '@/components/DocEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  return { title: design && role ? design.title : 'Design' };
}

export default async function EditPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/api/auth/login?next=/design/${id}`);
  const { design, role } = await loadDesign(id, user);
  if (!design) notFound();
  if (!canEdit(role)) redirect(`/d/${id}`);
  const props = { id, initialDesign: design.data, initialTitle: design.title, initialVisibility: design.visibility, role };
  return design.data?.kind === 'doc' ? <DocEditor {...props} /> : <Editor {...props} />;
}
