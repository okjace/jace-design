import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getGuest, loadDesign } from '@/lib/access';
import GuestGate from '@/components/GuestGate';
import RequestAccess from '@/components/RequestAccess';
import LiveViewer from '@/components/LiveViewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  return { title: design && role ? `Live: ${design.title}` : 'Live presentation', robots: { index: false } };
}

// Follow someone's presentation live: the slide changes when they change it.
export default async function LivePage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  const { design, role, perms, request, needsName } = await loadDesign(id, user, { guest });
  if (!design) notFound();
  if (needsName) return <GuestGate title={role ? design.title : 'a presentation'} next={`/d/${id}/live`} />;
  if (!role || !perms?.view) {
    return (
      <RequestAccess id={id} status={request} signedIn={!!user} who={user ? `@${user.username}` : guest?.name}
        owner={{ username: design.owner_username, name: design.owner_name, picture: design.owner_picture }} />
    );
  }
  if (design.data?.kind === 'doc' || design.data?.kind === 'sheet') notFound();
  return <LiveViewer id={id} title={design.title} design={design.data} />;
}
