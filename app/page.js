import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { q, usingEmbeddedDb } from '@/lib/db';
import { clientId } from '@/lib/jace';
import { PRESET_GROUPS } from '@/lib/design';
import DesignCard from '@/components/DesignCard';
import QuickCreate from '@/components/QuickCreate';
import DesignSearch from '@/components/DesignSearch';

export const dynamic = 'force-dynamic';

const ERRORS = {
  not_configured: 'Sign in with Jace is not set up yet: add JACE_CLIENT_ID and JACE_CLIENT_SECRET (see the README).',
  banned: 'This Jace account is banned.',
  access_denied: 'Sign-in was cancelled.',
  bad_state: 'Sign-in expired, please try again.',
  signin_failed: 'Sign-in failed. Please try again.',
};

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser().catch(() => null);
  const error = sp?.error ? ERRORS[sp.error] || `Sign-in error: ${sp.error}` : null;

  if (!user) {
    const trending = await q(
      `SELECT d.id, d.title, d.width, d.height, d.data, u.username, u.name, u.picture,
              (SELECT COUNT(*)::int FROM likes l WHERE l.design_id = d.id) AS likes
       FROM designs d JOIN users u ON u.id = d.owner_id WHERE d.visibility = 'public' AND NOT d.is_template
       ORDER BY likes DESC, d.created_at DESC LIMIT 8`
    ).catch(() => []);
    return (
      <main className="page">
        {error ? <div className="notice err">{error}</div> : null}
        {!clientId() ? <div className="notice">{ERRORS.not_configured}</div> : null}
        <section className="hero">
          <div className="hero-shapes">
            <span style={{ width: 380, height: 380, right: -80, top: -120 }} />
            <span style={{ width: 200, height: 200, right: 240, bottom: -90 }} />
          </div>
          <h1>Design anything. Share it everywhere.</h1>
          <p>Posts, slides, posters, cards, resumes, logos — start from a template or a blank page, import your own files, then share, download or print. Free and open source.</p>
          <div className="row wrap" style={{ marginTop: 28 }}>
            <a href="/api/auth/login?next=/new" className="btn btn-lg" style={{ background: '#fff', color: '#157a47' }}>Sign in with Jace to start</a>
            <Link href="/explore" className="btn btn-lg" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>Explore designs</Link>
          </div>
        </section>
        <div className="feature-grid">
          {[
            ['🎨', 'A real editor', 'Text, shapes, photos, emoji, gradients, filters, layers, multi-page, undo — all in your browser.'],
            ['🧩', 'Templates & sizes', '40+ sizes for social, video, print and docs, plus ready-made templates.'],
            ['📥', 'Import anything', 'Bring in images, SVGs, Jace Design files, or turn a text outline into slides.'],
            ['🔗', 'Share & collaborate', 'Public, link-only or private. Share with Jace users to view or edit.'],
            ['🖨️', 'Print & export', 'PNG, JPG, SVG, PDF, or print with paper sizes and crop marks.'],
            ['👤', 'Public profiles', 'Show off your work, follow creators, like, comment and remix.'],
          ].map(([i, t, d]) => (
            <div className="feature" key={t}><div className="ico">{i}</div><h3>{t}</h3><div className="muted">{d}</div></div>
          ))}
        </div>
        {trending.length ? (
          <>
            <h2>Popular on Jace Design</h2>
            <div className="grid">
              {trending.map((d) => <DesignCard key={d.id} d={d} author={{ username: d.username, name: d.name, picture: d.picture }} />)}
            </div>
          </>
        ) : null}
        <p className="muted center small" style={{ marginTop: 48 }}>
          Jace Design is open source (MIT). <a href="https://github.com/okjace/jace-design" style={{ textDecoration: 'underline' }}>View the code on GitHub</a>.
        </p>
      </main>
    );
  }

  const term = typeof sp?.q === 'string' ? sp.q.trim() : '';
  const all = await q(
    `SELECT id, title, width, height, data, visibility, is_template, updated_at FROM designs
     WHERE owner_id = $1 AND ($2 = '' OR title ILIKE '%' || $2 || '%') ORDER BY updated_at DESC LIMIT 160`,
    [user.id, term]
  );
  const mine = all.filter((d) => !d.is_template);
  const templates = all.filter((d) => d.is_template);
  const shared = await q(
    `SELECT d.id, d.title, d.width, d.height, d.data, s.role, s.perms, u.username, u.name, u.picture
     FROM shares s JOIN designs d ON d.id = s.design_id JOIN users u ON u.id = d.owner_id
     WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 60`,
    [user.id]
  );
  const allPresets = PRESET_GROUPS.flatMap((g) => g.items);
  const quick = ['Instagram post', 'Presentation 16:9', 'YouTube thumbnail', 'Poster (18×24 in)', 'Document (A4)', 'Business card']
    .map((n) => allPresets.find((p) => p.name === n)).filter(Boolean);

  return (
    <main className="page">
      {error ? <div className="notice err">{error}</div> : null}
      {usingEmbeddedDb() && process.env.VERCEL ? (
        <div className="notice">No database is connected, so designs won't be kept. Add a Postgres database (DATABASE_URL) in Vercel.</div>
      ) : null}
      <section className="hero" style={{ padding: '40px 40px' }}>
        <h1 style={{ fontSize: 38 }}>What will you design today, {user.name?.split(' ')[0] || user.username}?</h1>
        <QuickCreate presets={quick} />
      </section>
      <div className="row" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }} className="grow">Your designs</h2>
        <DesignSearch initial={term} />
      </div>
      <div style={{ height: 16 }} />
      {mine.length ? (
        <div className="grid">{mine.map((d) => <DesignCard key={d.id} d={d} mine />)}</div>
      ) : (
        <div className="card center">
          <p style={{ fontSize: 40, margin: 0 }}>🎨</p>
          <p>{term ? `No designs match “${term}”.` : 'No designs yet. Make your first one!'}</p>
          <Link href="/new" className="btn btn-primary">Create a design</Link>
        </div>
      )}
      {shared.length ? (
        <>
          <h2>Shared with you</h2>
          <div className="grid">
            {shared.map((d) => (
              <DesignCard key={d.id} d={d} author={{ username: d.username, name: d.name, picture: d.picture }} href={(d.perms?.edit ?? d.role === 'edit') ? `/design/${d.id}` : `/d/${d.id}`} />
            ))}
          </div>
        </>
      ) : null}
      {templates.length ? (
        <>
          <h2>Your templates</h2>
          <div className="grid">{templates.map((d) => <DesignCard key={d.id} d={d} mine />)}</div>
        </>
      ) : null}
    </main>
  );
}
