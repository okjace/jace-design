import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import Avatar from '@/components/Avatar';
import DesignCard from '@/components/DesignCard';
import FollowButton from '@/components/FollowButton';
import { lighten, listCols } from '@/lib/preview';

export const dynamic = 'force-dynamic';

async function find(username) {
  return one('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [decodeURIComponent(username)]);
}

export async function generateMetadata({ params }) {
  const { username } = await params;
  const u = await find(username);
  return u ? { title: `${u.name || u.username} (@${u.username})`, description: u.bio || `Designs by @${u.username} on Jace Design` } : { title: 'Not found' };
}

export default async function Profile({ params, searchParams }) {
  const { username } = await params;
  const sp = await searchParams;
  const tab = sp?.tab === 'likes' ? 'likes' : 'designs';
  const u = await find(username);
  if (!u) notFound();
  const me = await getUser();
  const isMe = me?.id === u.id;
  const [stats, followRow, designs] = await Promise.all([
    one(
      `SELECT (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS followers,
              (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following,
              (SELECT COUNT(*)::int FROM designs WHERE owner_id = $1 AND visibility = 'public' AND NOT is_template) AS designs,
              (SELECT COUNT(*)::int FROM likes l JOIN designs d ON d.id = l.design_id WHERE d.owner_id = $1) AS likes`,
      [u.id]
    ),
    me && !isMe ? one('SELECT 1 AS x FROM follows WHERE follower_id = $1 AND following_id = $2', [me.id, u.id]) : null,
    (tab === 'designs'
      ? q(
        `SELECT d.id, d.title, d.width, d.height, ${listCols('d')}, d.visibility, (SELECT COUNT(*)::int FROM likes l WHERE l.design_id = d.id) AS likes
         FROM designs d WHERE d.owner_id = $1 AND d.visibility = 'public' AND NOT d.is_template ORDER BY d.created_at DESC LIMIT 120`, [u.id])
      : q(
        `SELECT d.id, d.title, d.width, d.height, ${listCols('d')}, o.username, o.name, o.picture, (SELECT COUNT(*)::int FROM likes x WHERE x.design_id = d.id) AS likes
         FROM likes l JOIN designs d ON d.id = l.design_id JOIN users o ON o.id = d.owner_id
         WHERE l.user_id = $1 AND d.visibility = 'public' AND NOT d.is_template ORDER BY l.created_at DESC LIMIT 120`, [u.id])
    ).then(lighten),
  ]);
  const following = !!followRow;

  return (
    <main className="page">
      <div className="card profile-head">
        <Avatar user={u} size={104} />
        <div className="grow stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0 }}>{u.name || u.username}</h1>
          <div className="muted">@{u.username} · joined {new Date(u.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
          {u.bio ? <div style={{ whiteSpace: 'pre-wrap' }}>{u.bio}</div> : null}
          {u.website ? <a href={u.website} target="_blank" rel="noreferrer nofollow" style={{ color: 'var(--brand)' }}>🔗 {u.website.replace(/^https?:\/\//, '')}</a> : null}
          <div className="stats small">
            <span><b>{stats.designs}</b> designs</span>
            <span><b>{stats.followers}</b> followers</span>
            <span><b>{stats.following}</b> following</span>
            <span><b>{stats.likes}</b> likes</span>
          </div>
        </div>
        <div className="row">
          {isMe ? <Link className="btn" href="/settings">Edit profile</Link> : <FollowButton username={u.username} initial={following} signedIn={!!me} />}
        </div>
      </div>
      <div className="tabs">
        <Link className={`tab ${tab === 'designs' ? 'active' : ''}`} href={`/u/${encodeURIComponent(u.username)}`}>Designs</Link>
        <Link className={`tab ${tab === 'likes' ? 'active' : ''}`} href={`/u/${encodeURIComponent(u.username)}?tab=likes`}>Liked</Link>
      </div>
      {designs.length ? (
        <div className="grid">
          {designs.map((d) => <DesignCard key={d.id} d={d} author={tab === 'likes' ? { username: d.username, name: d.name, picture: d.picture } : null} href={`/d/${d.id}`} />)}
        </div>
      ) : (
        <div className="card center muted">
          {tab === 'likes' ? 'No liked designs yet.' : isMe ? <>You have no public designs yet. Open a design, press <b>Share</b> and choose <b>Public</b> to show it here.</> : 'No public designs yet.'}
        </div>
      )}
    </main>
  );
}
