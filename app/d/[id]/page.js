import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { canEdit, getGuest, loadDesign } from '@/lib/access';
import { one, q } from '@/lib/db';
import Avatar from '@/components/Avatar';
import DesignViewer from '@/components/DesignViewer';
import Comments from '@/components/Comments';
import GuestGate from '@/components/GuestGate';
import RequestAccess from '@/components/RequestAccess';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return { title: 'Design' };
  return {
    title: design.title,
    description: `A design by ${design.owner_name || design.owner_username} on Jace Design`,
    robots: design.visibility === 'public' ? undefined : { index: false },
  };
}

export default async function ViewPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  const { design, role, perms, request, needsName } = await loadDesign(id, user, { guest });
  if (!design) notFound();

  // Visitors without a Jace account give a name first.
  if (needsName) return <GuestGate title={role ? design.title : 'a design'} next={`/d/${id}`} />;

  // No access yet: ask the owner.
  if (!role) {
    return (
      <RequestAccess
        id={id}
        status={request}
        signedIn={!!user}
        who={user ? `@${user.username}` : guest?.name}
        owner={{ username: design.owner_username, name: design.owner_name, picture: design.owner_picture }}
      />
    );
  }

  const [, likes, likedRow, comments, remixOf, remixes] = await Promise.all([
    role !== 'owner' ? q('UPDATE designs SET views = views + 1 WHERE id = $1', [id]).catch(() => {}) : null,
    one('SELECT COUNT(*)::int AS n FROM likes WHERE design_id = $1', [id]),
    user ? one('SELECT 1 AS x FROM likes WHERE design_id = $1 AND user_id = $2', [id, user.id]) : null,
    q(`SELECT c.id, c.body, c.created_at, c.guest_name, u.username, u.name, u.picture FROM comments c LEFT JOIN users u ON u.id = c.user_id
       WHERE c.design_id = $1 ORDER BY c.created_at ASC LIMIT 300`, [id]),
    design.remix_of
      ? one(`SELECT d.id, d.title, u.username FROM designs d JOIN users u ON u.id = d.owner_id WHERE d.id = $1 AND d.visibility <> 'private'`, [design.remix_of])
      : null,
    one('SELECT COUNT(*)::int AS n FROM designs WHERE remix_of = $1', [id]),
  ]);
  const liked = !!likedRow;
  const owner = { username: design.owner_username, name: design.owner_name, picture: design.owner_picture };
  const isDoc = design.data?.kind === 'doc';

  return (
    <main className="page">
      <div className="viewer">
        <DesignViewer
          id={id} title={design.title} design={design.data} role={role} perms={perms} signedIn={!!user}
          likes={likes.n} liked={liked} visibility={design.visibility}
        />
        <aside className="stack" style={{ gap: 16 }}>
          <div className="card stack">
            <h1 style={{ fontSize: 24, margin: 0 }}>{design.title}</h1>
            <Link href={`/u/${encodeURIComponent(owner.username)}`} className="row">
              <Avatar user={owner} size={36} />
              <div><b>{owner.name || owner.username}</b><div className="small muted">@{owner.username}</div></div>
            </Link>
            <div className="small muted">
              {isDoc ? 'Document' : `${design.width} × ${design.height}px · ${design.data.pages.length} page${design.data.pages.length > 1 ? 's' : ''}`} · {design.views} views · {remixes.n} remixes
            </div>
            {remixOf ? <div className="small">Remix of <Link href={`/d/${remixOf.id}`} style={{ textDecoration: 'underline' }}>{remixOf.title}</Link> by @{remixOf.username}</div> : null}
            {canEdit(role) ? (user ? <Link href={`/design/${id}`} className="btn btn-primary">✏️ Edit</Link> : <a href={`/api/auth/login?next=/design/${id}`} className="btn btn-primary">Sign in with Jace to edit</a>) : null}
            {!user && guest?.name ? <div className="small muted">Viewing as {guest.name}</div> : null}
          </div>
          {perms.comment || comments.length ? (
            <div className="card" id="comments">
              <h3>Comments ({comments.length})</h3>
              <Comments
                id={id}
                canComment={perms.comment && (!!user || !!guest?.name)}
                signedIn={!!user}
                initial={comments.map((c) => ({ ...c, created_at: new Date(c.created_at).toISOString() }))}
              />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
