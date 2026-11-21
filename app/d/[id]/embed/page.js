import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import EmbedView from '@/components/EmbedView';

export const dynamic = 'force-dynamic';

// Embeds only work for public or link-shared designs that don't require asking first.
export default async function EmbedPage({ params }) {
  const { id } = await params;
  const design = await one('SELECT id, title, data, visibility, require_request, link_perms FROM designs WHERE id = $1', [id]);
  if (!design || design.visibility === 'private' || design.require_request || design.link_perms?.view === false) notFound();
  return <EmbedView id={id} title={design.title} design={design.data} />;
}
