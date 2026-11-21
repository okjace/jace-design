'use client';

/** The address a website section can be linked to (#name, or #section-N when it has no name). */
export const sectionAnchor = (page, i) => page.anchor || `section-${i + 1}`;

export function linkLabel(link, pages = []) {
  if (!link) return '';
  if (link.startsWith('#')) {
    const i = pages.findIndex((p, j) => `#${sectionAnchor(p, j)}` === link);
    return i >= 0 ? `Page ${i + 1}${pages[i].anchor ? ` · ${pages[i].anchor}` : ''}` : link;
  }
  if (link.startsWith('mailto:')) return `Email ${link.slice(7)}`;
  return link.replace(/^https?:\/\//, '');
}

/**
 * Choose where an item goes when it's clicked: another page (section) of this website, a web address, or an email.
 * value: current link ('#section', 'https://…', 'mailto:…' or '') · pages: the design's pages · compact: smaller (right-click menu)
 */
export default function LinkPicker({ value = '', onChange, pages = [], isSite, compact }) {
  const mode = !value ? 'none' : value.startsWith('#') ? 'page' : value.startsWith('mailto:') ? 'email' : 'web';
  const size = compact ? { padding: '5px 8px', fontSize: 13 } : { fontSize: 13 };

  const setMode = (m) => {
    if (m === 'none') onChange('');
    else if (m === 'page') onChange(`#${sectionAnchor(pages[0] || {}, 0)}`);
    else if (m === 'web') onChange(mode === 'web' ? value : 'https://');
    else if (m === 'email') onChange(mode === 'email' ? value : 'mailto:');
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <select className="input" value={mode} onChange={(e) => setMode(e.target.value)} style={size}>
        <option value="none">No link</option>
        {isSite || mode === 'page' ? <option value="page">📄 A page of this website</option> : null}
        <option value="web">🌐 A web address</option>
        <option value="email">✉️ An email address</option>
      </select>
      {mode === 'page' ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={size}>
          {pages.map((p, i) => (
            <option key={p.id} value={`#${sectionAnchor(p, i)}`}>Page {i + 1}{p.anchor ? ` · ${p.anchor}` : ''}</option>
          ))}
        </select>
      ) : null}
      {mode === 'web' ? (
        <input className="input" value={value} placeholder="https://example.com" onChange={(e) => onChange(e.target.value.trim().slice(0, 500))} style={size} />
      ) : null}
      {mode === 'email' ? (
        <input className="input" value={value.replace(/^mailto:/, '')} placeholder="you@example.com" onChange={(e) => onChange(`mailto:${e.target.value.trim().slice(0, 200)}`)} style={size} />
      ) : null}
      {mode === 'web' && value && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(value) ? <div className="small" style={{ color: 'var(--danger)' }}>Enter a full address, like https://example.com</div> : null}
      {mode === 'page' ? <div className="small muted">Clicking it jumps to that page of your website. Name pages (click the empty canvas → Section name) to make this list easier to read.</div> : null}
    </div>
  );
}
