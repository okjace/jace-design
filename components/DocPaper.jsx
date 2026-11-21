// A read-only document page (Word-style). The HTML is sanitized on the server before it's saved.
export function docPageCss(design) {
  const m = design.page?.margin ?? 1;
  return { width: design.width, minHeight: design.height, padding: `${m * 96}px` };
}

export default function DocPaper({ design, style }) {
  return (
    <div className="doc-paper doc-content" style={{ ...docPageCss(design), ...style }} dangerouslySetInnerHTML={{ __html: design.html || '' }} />
  );
}
