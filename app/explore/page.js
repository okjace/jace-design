import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { q } from '@/lib/db';
import DesignCard from '@/components/DesignCard';
import DesignSearch from '@/components/DesignSearch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore' };

export default async function Explore({ searchParams }) {
  const sp = await searchParams;
  const term = typeof sp?.q === 'string' ? sp.q.trim() : '';
  const sort = ['popular', 'following'].includes(sp?.sort) ? sp.sort : 'new';
  const me = await getUser();
  const params = [term];
  let where = `d.visibility = 'public' AND NOT d.is_template AND ($1 = '' OR d.title ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%')`;
  if (sort === 'following' && me) {
    params.push(me.id);
    where += ` AND d.owner_id IN (SELECT following_id FROM follows WHERE follower_id = $2)`;
  }
  const order = sort === 'popular' ? 'likes DESC, d.created_at DESC' : 'd.created_at DESC';
  const rows = await q(
    `SELECT d.id, d.title, d.width, d.height, d.data, u.username, u.name, u.picture,
            (SELECT COUNT(*)::int FROM likes l WHERE l.design_id = d.id) AS likes
     FROM designs d JOIN users u ON u.id = d.owner_id WHERE ${where} ORDER BY ${order} LIMIT 96`,
    params
  );
  const people = term
    ? await q(`SELECT username, name, picture FROM users WHERE username ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%' LIMIT 8`, [term])
    : [];
  const link = (s) => `/explore?sort=${s}${term ? `&q=${encodeURIComponent(term)}` : ''}`;
  return (
    <main className="page">
      <div className="row wrap">
        <div className="grow"><h1>Explore</h1><p className="muted" style={{ margin: 0 }}>Public designs from the Jace community. Like, comment, or remix any of them.</p></div>
        <DesignSearch initial={term} placeholder="Search designs & people" />
      </div>
      <div className="tabs">
        <Link className={`tab ${sort === 'new' ? 'active' : ''}`} href={link('new')}>Newest</Link>
        <Link className={`tab ${sort === 'popular' ? 'active' : ''}`} href={link('popular')}>Popular</Link>
        {me ? <Link className={`tab ${sort === 'following' ? 'active' : ''}`} href={link('following')}>Following</Link> : null}
      </div>
      {people.length ? (
        <div className="row wrap" style={{ marginBottom: 18 }}>
          {people.map((p) => <Link key={p.username} className="btn btn-sm" href={`/u/${encodeURIComponent(p.username)}`}>@{p.username}</Link>)}
        </div>
      ) : null}
      {rows.length ? (
        <div className="grid">{rows.map((d) => <DesignCard key={d.id} d={d} author={{ username: d.username, name: d.name, picture: d.picture }} />)}</div>
      ) : (
        <div className="card center muted">{sort === 'following' ? 'People you follow haven’t posted public designs yet.' : 'Nothing here yet — be the first to publish a design!'}</div>
      )}
    </main>
  );
}
