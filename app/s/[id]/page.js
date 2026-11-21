import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getGuest, loadDesign, recordVisit } from '@/lib/access';
import DesignPage from '@/components/DesignPage';
import GuestGate from '@/components/GuestGate';
import RequestAccess from '@/components/RequestAccess';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return { title: 'Website' };
  return { title: { absolute: design.data?.site?.title || design.title }, description: `Made with Jace Design` };
}

const safeLink = (l) => (typeof l === 'string' && /^(https?:\/\/|mailto:|#)/i.test(l.trim()) ? l.trim() : null);

// A website made in Jace Design: its pages are stacked as sections, links are clickable.
export default async function SitePage({ params }) {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  const { design, role, request, needsName } = await loadDesign(id, user, { guest });
  if (!design) notFound();
  if (needsName) return <GuestGate title={role ? design.title : 'a website'} next={`/s/${id}`} />;
  if (!role) {
    return <RequestAccess id={id} status={request} signedIn={!!user} who={user ? `@${user.username}` : guest?.name}
      owner={{ username: design.owner_username, name: design.owner_name, picture: design.owner_picture }} />;
  }
  await recordVisit(design, user, guest);
  const d = design.data;
  const W = d.width, H = d.height;
  const sections = d.pages.map((p, i) => ({ page: p, anchor: p.anchor || `section-${i + 1}` }));
  const named = sections.filter((s) => s.page.anchor);

  return (
    <div className="site-root">
      {d.site?.nav !== false && named.length ? (
        <nav className="site-nav">
          <a href="#top" className="site-brand">{d.site?.title || design.title}</a>
          <div className="site-links">
            {named.map((s) => <a key={s.anchor} href={`#${s.anchor}`}>{s.anchor.replace(/[-_]/g, ' ')}</a>)}
          </div>
        </nav>
      ) : null}
      <div id="top" />
      {sections.map(({ page, anchor }, i) => (
        <section key={page.id} id={anchor} className="site-section" style={{ aspectRatio: `${W} / ${H}` }}>
          <DesignPage design={d} page={page} width="100%" height="100%" uidPrefix={`s${i}-`} style={{ display: 'block' }} media="controls" />
          {page.elements.filter((e) => safeLink(e.link) && !e.hidden).map((e) => {
            const href = safeLink(e.link);
            const external = /^https?:/i.test(href);
            return (
              <a key={e.id} href={href} className="site-hotspot" aria-label={e.type === 'text' ? e.text : 'Link'}
                target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer nofollow' : undefined}
                style={{ left: `${(e.x / W) * 100}%`, top: `${(e.y / H) * 100}%`, width: `${(e.w / W) * 100}%`, height: `${(e.h / H) * 100}%`,
                  transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }} />
            );
          })}
        </section>
      ))}
      <footer className="site-footer">
        Made with <a href="/" target="_blank" rel="noreferrer">Jace Design</a>
      </footer>
    </div>
  );
}
