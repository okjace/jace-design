import 'server-only';
import sanitizeHtml from 'sanitize-html';

const css = /^[\w\s#%(),.\-'"!/+*]+$/;
const STYLES = Object.fromEntries(
  ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align',
    'line-height', 'margin-left', 'margin-top', 'margin-bottom', 'padding', 'padding-left', 'width', 'height', 'max-width',
    'border', 'border-collapse', 'border-color', 'border-width', 'border-style', 'vertical-align', 'letter-spacing',
    'text-transform', 'text-indent', 'list-style-type', 'float', 'display'].map((k) => [k, [css]])
);

/** Clean document HTML so it is safe to show to anyone. */
export function sanitizeDocHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup',
      'span', 'div', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'caption', 'colgroup', 'col', 'hr', 'mark', 'small', 'font'],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'dir'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'title'],
      td: ['colspan', 'rowspan', 'width'], th: ['colspan', 'rowspan', 'width'], col: ['span', 'width'],
      ol: ['start', 'type'], font: ['color', 'face', 'size'],
    },
    allowedClasses: { '*': ['page-break', 'doc-title', 'doc-subtitle', 'checklist', 'checked'] },
    allowedStyles: { '*': STYLES },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['data', 'https'] },
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }) },
  });
}

/** Sanitize the parts of a (normalized) design that can hold HTML. */
export function sanitizeDesign(d) {
  if (d.kind === 'doc') d.html = sanitizeDocHtml(d.html);
  return d;
}
