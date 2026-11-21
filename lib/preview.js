import 'server-only';

/**
 * Columns for design lists: the small saved thumbnail, and the full data only for
 * designs that don't have a thumbnail yet (older ones). Use with lighten().
 */
export const listCols = (a = 'd') => `${a}.thumb, CASE WHEN ${a}.thumb IS NULL THEN ${a}.data END AS data`;

const stripImages = (html) => String(html || '').replace(/<img\b[^>]*>/gi, '');

/** Trim list rows down to what a preview needs, so pages stay small and fast. */
export function lighten(rows) {
  return rows.map((r) => {
    let d = r.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d) return { ...r, data: null };
    if (d.kind === 'doc') {
      return { ...r, data: { kind: 'doc', width: d.width, height: d.height, page: d.page, html: stripImages(d.html).slice(0, 6000) } };
    }
    const first = d.pages?.[0];
    return { ...r, data: first ? { width: d.width, height: d.height, pages: [first] } : null };
  });
}
