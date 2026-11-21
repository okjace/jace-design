import { getUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { VISIBLE } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Live inbox: a Server-Sent Events stream that tells the browser the moment its inbox changes.
// It checks a tiny summary about once a second and closes after ~50s; the browser reconnects by itself.
export async function GET(request) {
  const user = await getUser();
  if (!user) return new Response('Sign in required', { status: 401 });

  const encoder = new TextEncoder();
  const summary = () => one(
    `SELECT COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread, COUNT(*)::int AS total,
            COALESCE(MAX(created_at)::text, '') AS latest, COALESCE(MAX(read_at)::text, '') AS last_read,
            COUNT(*) FILTER (WHERE status <> 'new')::int AS answered
     FROM notifications n WHERE n.user_id = $1 AND ${VISIBLE}`,
    [user.id]
  );

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text) => { try { controller.enqueue(encoder.encode(text)); } catch {} };
      let last = '';
      const started = Date.now();
      send('retry: 1500\n\n');
      while (!request.signal.aborted && Date.now() - started < 50_000) {
        try {
          const s = await summary();
          const sig = `${s.unread}|${s.total}|${s.latest}|${s.last_read}|${s.answered}`;
          if (sig !== last) {
            send(`event: inbox\ndata: ${JSON.stringify({ unread: s.unread, changed: last !== '' })}\n\n`);
            last = sig;
          } else {
            send(': ping\n\n'); // keeps the connection open
          }
        } catch {
          send(': db busy\n\n');
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
