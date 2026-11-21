// Proxies an Openverse image through our own domain so it can be drawn on a canvas and exported.
// Only Openverse ids are accepted (never arbitrary URLs).
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response('Bad id', { status: 400 });
  const res = await fetch(`https://api.openverse.org/v1/images/${id}/thumb/?full_size=true&compressed=true`, {
    headers: { 'User-Agent': 'JaceDesign/1.0 (open-source design app)' },
    next: { revalidate: 86400 },
  });
  const type = res.headers.get('content-type') || '';
  // SVG could carry script when opened directly on our domain, so only plain raster images pass.
  if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)/.test(type)) return new Response('Not found', { status: 404 });
  return new Response(res.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' },
  });
}
