import { after } from 'next/server';
import { handler, json, newId, requireUser, siteUrl } from '@/lib/auth';
import { q } from '@/lib/db';
import { loadDesign, shareDefaults } from '@/lib/access';
import { emailUser } from '@/lib/jace';
import { notify } from '@/lib/notify';

export const POST = handler(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !role) return json({ error: 'Not found' }, 404);
  const nid = newId();
  const mine = design.owner_id === user.id;
  const title = design.is_template ? design.title : mine ? `${design.title} (copy)` : `Remix of ${design.title}`;
  const def = shareDefaults(user);
  await q(
    `INSERT INTO designs (id, owner_id, title, width, height, data, remix_of, thumb, visibility, link_perms, require_request)
     VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8, $9, $10::text::jsonb, $11)`,
    [nid, user.id, title.slice(0, 120), design.width, design.height, JSON.stringify(design.data), mine ? null : id, design.thumb || null,
      def.visibility, JSON.stringify(def.link_perms), def.require_request]
  );
  if (!mine && !design.is_template) {
    const base = await siteUrl();
    await notify(design.owner_id, { type: 'remix', designId: id, actor: user, data: { remix_id: nid } });
    after(() => emailUser(design.owner_id, {
      subject: `${user.name || user.username} remixed "${design.title}"`,
      heading: 'Your design was remixed',
      message: `${user.name || user.username} (@${user.username}) made a remix of your design "${design.title}". Nice work!`,
      button_label: 'See their profile',
      button_url: `${base}/u/${encodeURIComponent(user.username)}`,
    }));
  }
  return json({ id: nid }, 201);
});
