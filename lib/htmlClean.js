'use client';
// Browser-side HTML cleaner for documents (pasted text, imports, AI output).
// The server cleans again with sanitize-html on save; this keeps the editor itself safe.

const TAGS = new Set(['P', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'SUB', 'SUP',
  'SPAN', 'DIV', 'BLOCKQUOTE', 'PRE', 'CODE', 'UL', 'OL', 'LI', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
  'CAPTION', 'COLGROUP', 'COL', 'HR', 'MARK', 'SMALL', 'FONT']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'HEAD', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE', 'NOSCRIPT']);
const ATTRS = new Set(['style', 'class', 'align', 'dir', 'href', 'title', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'span', 'start', 'type', 'color', 'face', 'size']);
const STYLE_OK = new Set(['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line',
  'text-align', 'line-height', 'margin-left', 'margin-top', 'margin-bottom', 'padding', 'padding-left', 'width', 'height', 'max-width', 'border',
  'border-collapse', 'border-color', 'border-width', 'border-style', 'vertical-align', 'letter-spacing', 'text-transform', 'text-indent', 'list-style-type', 'float', 'display']);

function cleanStyle(style) {
  return style.split(';').map((d) => d.trim()).filter(Boolean).filter((d) => {
    const [k, ...v] = d.split(':');
    const val = v.join(':');
    return STYLE_OK.has(k.trim().toLowerCase()) && !/url\(|expression|javascript:|@import/i.test(val);
  }).join('; ');
}

function okUrl(u, img) {
  const s = (u || '').trim();
  if (img) return /^(data:image\/(png|jpe?g|gif|webp);|https:\/\/|\/api\/images\/)/i.test(s);
  return /^(https?:|mailto:|#|\/)/i.test(s);
}

function walk(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 8) { child.remove(); continue; }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName;
    if (DROP.has(tag)) { child.remove(); continue; }
    if (!TAGS.has(tag)) {
      walk(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const a of [...child.attributes]) {
      const name = a.name.toLowerCase();
      if (!ATTRS.has(name)) child.removeAttribute(a.name);
      else if (name === 'style') { const s = cleanStyle(a.value); if (s) child.setAttribute('style', s); else child.removeAttribute('style'); }
      else if (name === 'href' && !okUrl(a.value, false)) child.removeAttribute(a.name);
      else if (name === 'src' && !okUrl(a.value, true)) child.removeAttribute(a.name);
    }
    if (tag === 'A') { child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer nofollow'); }
    walk(child);
  }
}

export function cleanHtml(html) {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  walk(doc.body);
  return doc.body.innerHTML;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** A small Markdown → HTML converter (headings, lists, quotes, code, tables, bold/italic/links). */
export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara(); closeList();
      const code = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      flushPara(); closeList();
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = cells(line);
      i++;
      const rows = [];
      while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) rows.push(cells(lines[++i]));
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    closeList();
    para.push(line.trim());
  }
  flushPara(); closeList();
  return out.join('\n');
}

export function textToHtml(text) {
  return String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export function htmlToText(html) {
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,tr,div').forEach((b) => b.append('\n'));
  return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
