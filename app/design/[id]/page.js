import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { canEdit, loadDesign, recordVisit } from '@/lib/access';
import { one } from '@/lib/db';
import Editor from '@/components/Editor';
import DocEditor from '@/components/DocEditor';
import SheetEditor from '@/components/SheetEditor';

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
  await recordVisit(design, user, null);
  // The exact version (with microseconds) so saves can tell if someone else saved in the meantime.
  const ver = await one('SELECT updated_at::text AS v FROM designs WHERE id = $1', [id]);
  const props = { id, initialDesign: design.data, initialTitle: design.title, initialVisibility: design.visibility, role, version: ver?.v || null };
  if (design.data?.kind === 'sheet') return <SheetEditor {...props} />;
  return design.data?.kind === 'doc' ? <DocEditor {...props} /> : <Editor {...props} />;
}
