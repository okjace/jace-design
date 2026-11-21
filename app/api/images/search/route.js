import { handler, json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UA = { 'User-Agent': 'JaceDesign/1.0 (open-source design app; https://github.com/okjace/jace-design)' };
const b64 = (s) => Buffer.from(s).toString('base64url');

// Small in-memory cache (per server instance) so repeat searches are instant.
const cache = new Map();
const TTL = 10 * 60 * 1000;
function remember(key, value) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}

async function fetchJson(url, { timeout = 6000, tries = 2 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', ...UA }, signal: AbortSignal.timeout(timeout), next: { revalidate: 3600 } });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) return null; // not worth retrying
    } catch {
      // timeout or network error: retry
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

// 1) Openverse: openly licensed photos and illustrations.
async function openverse(term, page, kind) {
  const api = new URL('https://api.openverse.org/v1/images/');
  api.searchParams.set('q', term);
  api.searchParams.set('page_size', '20'); // the most Openverse allows without an API key
  api.searchParams.set('page', String(page));
  api.searchParams.set('mature', 'false');
  if (kind) api.searchParams.set('category', kind);
  const data = await fetchJson(api);
  if (!data?.results) return null;
  return {
    hasMore: page < (data.page_count || 1),
    results: data.results.map((r) => ({
      id: r.id,
      title: r.title || '',
      creator: r.creator || '',
      license: `${(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
      source: r.foreign_landing_url || '',
      width: r.width || 0,
      height: r.height || 0,
      thumb: `/api/images/${r.id}`,
      full: `/api/images/${r.id}?full=1`,
    })),
  };
}

// 2) Wikimedia Commons: huge free image library, used when Openverse is busy or finds nothing.
async function wikimedia(term, page) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6',
    gsrsearch: `${term} filetype:bitmap`, gsrlimit: '20', gsroffset: String((page - 1) * 20),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName', iiurlwidth: '330',
  }).forEach(([k, v]) => api.searchParams.set(k, v));
  const data = await fetchJson(api, { timeout: 7000 });
  const pages = data?.query?.pages;
  if (!pages) return data ? { results: [], hasMore: false } : null;
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').trim();
  const results = Object.values(pages)
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl || !/\.(jpe?g|png|webp|gif)$/i.test(p.title || '')) return null;
      const thumb = ii.thumburl.split('?')[0];
      const big = ii.width > 1280 ? thumb.replace(/\/\d+px-/, '/1280px-') : ii.url.split('?')[0];
      const m = ii.extmetadata || {};
      return {
        id: `w${p.pageid}`,
        title: strip(m.ObjectName?.value) || p.title.replace(/^File:|\.\w+$/g, ''),
        creator: strip(m.Artist?.value).slice(0, 80),
        license: strip(m.LicenseShortName?.value) || 'See source',
        source: ii.descriptionurl || '',
        width: ii.width || 0,
        height: ii.height || 0,
        thumb: `/api/images/w?u=${b64(thumb)}`,
        full: `/api/images/w?u=${b64(big)}`,
      };
    })
    .filter(Boolean);
  return { results, hasMore: !!data.continue };
}

export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const term = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const page = Math.min(20, Math.max(1, Number(url.searchParams.get('page')) || 1));
  const kindParam = url.searchParams.get('kind');
  const kind = kindParam === 'illustration' ? 'illustration' : kindParam === 'photo' ? 'photograph' : '';
  if (!term) return json({ results: [], page, hasMore: false });

  const key = `${term.toLowerCase()}|${page}|${kind}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json(hit.value);

  let out = await openverse(term, page, kind);
  let provider = 'openverse';
  if (!out || !out.results.length) {
    const wiki = await wikimedia(term, page);
    if (wiki && (wiki.results.length || !out)) { out = wiki; provider = 'wikimedia'; }
  }
  if (!out) return json({ error: "Couldn't reach the image libraries. Try again in a moment.", results: [], page, hasMore: false }, 502);
  return json(remember(key, { ...out, page, provider }));
});
