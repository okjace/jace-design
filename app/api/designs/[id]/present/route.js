import { getUser, handler, json, requireUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { canEdit, getGuest, loadDesign } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The presenter says which slide they're on (and keeps saying it every few seconds while presenting).
export const POST = handler(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  const { design, role } = await loadDesign(id, user);
  if (!design || !canEdit(role)) return json({ error: 'Not found' }, 404);
  const b = await request.json().catch(() => ({}));
  if (b.on === false) {
    await q('DELETE FROM live_presents WHERE design_id = $1', [id]);
    return json({ ok: true });
  }
  const page = Math.max(0, Math.min(999, Number(b.page) || 0));
  await q(
    `INSERT INTO live_presents (design_id, presenter_id, presenter_name, page, started_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (design_id) DO UPDATE SET presenter_id = EXCLUDED.presenter_id, presenter_name = EXCLUDED.presenter_name, page = EXCLUDED.page, updated_at = NOW()`,
    [id, user.id, String(user.name || user.username || '').slice(0, 60), page]
  );
  return json({ ok: true });
});

// Viewers follow along: a live stream of { live, page, by }. Closes after ~50 s; the browser reconnects.
export async function GET(request, { params }) {
  const { id } = await params;
  const user = await getUser();
  const guest = user ? null : await getGuest();
  const { design, role, perms } = await loadDesign(id, user, { guest });
  if (!design || !role || !perms?.view) return new Response('Not found', { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (t) => { try { controller.enqueue(encoder.encode(t)); } catch {} };
      send('retry: 1500\n\n');
      let last = '';
      const started = Date.now();
      while (!request.signal.aborted && Date.now() - started < 50_000) {
        try {
          const r = await one(`SELECT page, presenter_name, updated_at > NOW() - INTERVAL '30 seconds' AS fresh FROM live_presents WHERE design_id = $1`, [id]);
          const s = JSON.stringify(r?.fresh ? { live: true, page: r.page, by: r.presenter_name } : { live: false });
          if (s !== last) { send(`event: slide\ndata: ${s}\n\n`); last = s; } else send(': ping\n\n');
        } catch {
          send(': busy\n\n');
        }
        await new Promise((res) => setTimeout(res, 700));
      }
      try { controller.close(); } catch {}
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
