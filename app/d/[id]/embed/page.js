import { notFound } from 'next/navigation';
import { loadDesign } from '@/lib/access';
import EmbedView from '@/components/EmbedView';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({ params }) {
  const { id } = await params;
  const { design } = await loadDesign(id, null);
  if (!design || design.visibility === 'private') notFound();
  return <EmbedView id={id} title={design.title} design={design.data} />;
}
