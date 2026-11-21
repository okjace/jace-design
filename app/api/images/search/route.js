import { handler, json } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Free photo & illustration search through Openverse (openly licensed images, no API key needed).
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const term = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const page = Math.min(20, Math.max(1, Number(url.searchParams.get('page')) || 1));
  const kindParam = url.searchParams.get('kind');
  const kind = kindParam === 'illustration' ? 'illustration' : kindParam === 'photo' ? 'photograph' : '';
  if (!term) return json({ results: [], page, hasMore: false });
  const api = new URL('https://api.openverse.org/v1/images/');
  api.searchParams.set('q', term);
  api.searchParams.set('page_size', '30');
  api.searchParams.set('page', String(page));
  api.searchParams.set('mature', 'false');
  if (kind) api.searchParams.set('category', kind);
  const res = await fetch(api, { headers: { Accept: 'application/json', 'User-Agent': 'JaceDesign/1.0 (open-source design app)' }, next: { revalidate: 3600 } });
  if (!res.ok) return json({ error: 'Image search is busy right now. Try again in a moment.', results: [] }, 502);
  const data = await res.json();
  const results = (data.results || []).map((r) => ({
    id: r.id,
    title: r.title || '',
    creator: r.creator || '',
    license: `${(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
    source: r.foreign_landing_url || '',
    width: r.width || 0,
    height: r.height || 0,
  }));
  return json({ results, page, hasMore: page < (data.page_count || 1) });
});
