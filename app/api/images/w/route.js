// Proxies a Wikimedia Commons image through our own domain (so it can be exported from a canvas).
// Only Wikimedia's own image servers are allowed — never arbitrary URLs.
const UA = { 'User-Agent': 'JaceDesign/1.0 (open-source design app; https://github.com/okjace/jace-design)' };
const OK_TYPE = /^image\/(jpeg|png|webp|gif)/;

export async function GET(request) {
  let target;
  try {
    target = new URL(Buffer.from(new URL(request.url).searchParams.get('u') || '', 'base64url').toString('utf8'));
  } catch {
    return new Response('Bad image', { status: 400 });
  }
  const allowedHost = target.hostname === 'upload.wikimedia.org' || target.hostname === 'thumb.wikimedia.org';
  if (target.protocol !== 'https:' || !allowedHost || target.port || !target.pathname.startsWith('/wikipedia/commons/')) {
    return new Response('Bad image', { status: 400 });
  }
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(target, { headers: UA, redirect: 'error', signal: AbortSignal.timeout(9000), next: { revalidate: 86400 } });
      const type = res.headers.get('content-type') || '';
      if (res.ok && OK_TYPE.test(type)) {
        return new Response(res.body, {
          headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable', 'X-Content-Type-Options': 'nosniff' },
        });
      }
      if (res.status !== 429 && res.status < 500) break;
    } catch {
      // timeout / network: retry once
    }
  }
  return new Response('Not found', { status: 404 });
}
