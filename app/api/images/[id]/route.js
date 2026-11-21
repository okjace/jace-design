// Proxies an Openverse image through our own domain so it can be drawn on a canvas and exported.
// Only Openverse ids are accepted (never arbitrary URLs). ?full=1 gets the large version; otherwise a small preview.
const UA = { 'User-Agent': 'JaceDesign/1.0 (open-source design app; https://github.com/okjace/jace-design)' };
const OK_TYPE = /^image\/(jpeg|png|webp|gif|avif)/; // SVG could carry script when opened directly, so only raster images pass

async function grab(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(9000), next: { revalidate: 86400 } });
      const type = res.headers.get('content-type') || '';
      if (res.ok && OK_TYPE.test(type)) return { res, type };
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      // timeout / network: retry once
    }
  }
  return null;
}

export async function GET(request, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response('Bad id', { status: 400 });
  const full = new URL(request.url).searchParams.get('full') === '1';
  const base = `https://api.openverse.org/v1/images/${id}/thumb/`;
  // Try the wanted size first; if it fails, the other size is better than nothing.
  const tries = full ? [`${base}?full_size=true&compressed=true`, base] : [base, `${base}?full_size=true&compressed=true`];
  for (const url of tries) {
    const got = await grab(url);
    if (got) {
      return new Response(got.res.body, {
        headers: { 'Content-Type': got.type, 'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable', 'X-Content-Type-Options': 'nosniff' },
      });
    }
  }
  return new Response('Not found', { status: 404 });
}
