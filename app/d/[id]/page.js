import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { canEdit, loadDesign } from '@/lib/access';
import { one, q } from '@/lib/db';
import Avatar from '@/components/Avatar';
import DesignViewer from '@/components/DesignViewer';
import Comments from '@/components/Comments';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return { title: 'Not found' };
  return {
    title: design.title,
    description: `A design by ${design.owner_name || design.owner_username} on Jace Design`,
    robots: design.visibility === 'public' ? undefined : { index: false },
  };
}

export default async function ViewPage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) notFound();
  if (role === 'view' && (!user || user.id !== design.owner_id)) {
    await q('UPDATE designs SET views = views + 1 WHERE id = $1', [id]).catch(() => {});
  }
  const likes = await one('SELECT COUNT(*)::int AS n FROM likes WHERE design_id = $1', [id]);
  const liked = user ? !!(await one('SELECT 1 AS x FROM likes WHERE design_id = $1 AND user_id = $2', [id, user.id])) : false;
  const comments = await q(
    `SELECT c.id, c.body, c.created_at, u.username, u.name, u.picture FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.design_id = $1 ORDER BY c.created_at ASC LIMIT 300`, [id]);
  const remixOf = design.remix_of ? await one(
    `SELECT d.id, d.title, u.username FROM designs d JOIN users u ON u.id = d.owner_id WHERE d.id = $1 AND d.visibility <> 'private'`, [design.remix_of]) : null;
  const remixes = await one('SELECT COUNT(*)::int AS n FROM designs WHERE remix_of = $1', [id]);
  const owner = { username: design.owner_username, name: design.owner_name, picture: design.owner_picture };

  return (
    <main className="page">
      <div className="viewer">
        <DesignViewer
          id={id} title={design.title} design={design.data} role={role} signedIn={!!user}
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
              {design.width} × {design.height}px · {design.data.pages.length} page{design.data.pages.length > 1 ? 's' : ''} · {design.views} views · {remixes.n} remixes
            </div>
            {remixOf ? <div className="small">Remix of <Link href={`/d/${remixOf.id}`} style={{ textDecoration: 'underline' }}>{remixOf.title}</Link> by @{remixOf.username}</div> : null}
            {canEdit(role) ? <Link href={`/design/${id}`} className="btn btn-primary">✏️ Edit design</Link> : null}
          </div>
          <div className="card" id="comments">
            <h3>Comments ({comments.length})</h3>
            <Comments id={id} signedIn={!!user} initial={comments.map((c) => ({ ...c, created_at: new Date(c.created_at).toISOString() }))} />
          </div>
        </aside>
      </div>
    </main>
  );
}
