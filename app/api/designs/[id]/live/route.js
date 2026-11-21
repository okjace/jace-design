import { getUser } from '@/lib/auth';
import { loadDesign } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Live access check for an open editor: tells the browser right away if the person's access changes
// (removed, blocked, turned into view-only, or the design was deleted). Closes after ~50s; the browser reconnects.
export async function GET(request, { params }) {
  const { id } = await params;
  const user = await getUser();
  const encoder = new TextEncoder();

  const check = async () => {
    const { design, role, perms } = await loadDesign(id, user);
    if (!design) return { status: 'deleted' };
    return { status: role ? 'ok' : 'removed', role, edit: !!(role === 'owner' || perms?.edit), view: !!perms?.view };
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text) => { try { controller.enqueue(encoder.encode(text)); } catch {} };
      send('retry: 1500\n\n');
      let last = '';
      const started = Date.now();
      while (!request.signal.aborted && Date.now() - started < 50_000) {
        try {
          const s = await check();
          const sig = JSON.stringify(s);
          if (sig !== last) { send(`event: access\ndata: ${sig}\n\n`); last = sig; }
          else send(': ping\n\n');
        } catch {
          send(': busy\n\n');
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
