'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ShareModal from './ShareModal';
import AiHelper from './AiHelper';
import SaveTemplate from './SaveTemplate';
import ImageSearch from './ImageSearch';
import { DOC_SIZES, FONTS, normalizeDesign } from '@/lib/design';
import { cleanHtml, markdownToHtml, textToHtml } from '@/lib/htmlClean';
import { fileToDataUrl } from '@/lib/export';
import { exportDocHtml, exportDocText, exportDocWord } from '@/lib/docExport';
import { aiToDocHtml } from '@/lib/ai';
import { loadGoogleFont, registerFonts } from '@/lib/fonts';

const SIZES_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const STYLES = [['p', 'Normal text'], ['h1', 'Title'], ['h2', 'Heading 1'], ['h3', 'Heading 2'], ['h4', 'Heading 3'], ['blockquote', 'Quote'], ['pre', 'Code']];
const SPACING = [['1', 'Single'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', 'Double']];
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div';

export default function DocEditor({ id, initialDesign, initialTitle, initialVisibility, role }) {
  const [meta, setMeta] = useState(() => normalizeDesign(initialDesign));
  const [title, setTitle] = useState(initialTitle);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [save, setSave] = useState('saved');
  const [modal, setModal] = useState(null); // share | download | template | photos | page
  const [ai, setAi] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [stats, setStats] = useState({ words: 0, chars: 0, pages: 1 });
  const [fmt, setFmt] = useState({});
  const [find, setFind] = useState(null); // { q, r, count }
  const editRef = useRef(null);
  const rangeRef = useRef(null);
  const aiRange = useRef(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const titleRef = useRef(title);
  titleRef.current = title;
  const timer = useRef(null);
  const saving = useRef(false);
  const again = useRef(false);
  const fileRef = useRef(null);
  const imgRef = useRef(null);

  const margin = meta.page?.margin ?? 1;
  const fonts = [...new Set([...(meta.fonts || []).map((f) => f.family), ...(meta.googleFonts || []), ...FONTS, 'Arial', 'Georgia', 'Times New Roman', 'Courier New'])];

  // ---------- load ----------
  useEffect(() => {
    const el = editRef.current;
    el.innerHTML = cleanHtml(initialDesign?.html || '<p></p>');
    try { document.execCommand('styleWithCSS', false, true); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
    registerFonts(metaRef.current);
    updateStats();
    if (new URLSearchParams(location.search).get('share') === '1') setModal('share');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- saving ----------
  const doSave = useCallback(async () => {
    if (saving.current) { again.current = true; return; }
    saving.current = true; again.current = false;
    setSave('saving');
    try {
      const html = editRef.current?.innerHTML || '';
      const body = JSON.stringify({ design: { ...metaRef.current, html }, title: titleRef.current });
      if (body.length > 4_300_000) { setSave('toobig'); return; }
      const r = await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      setSave(r.ok ? 'saved' : 'error');
    } catch {
      setSave('error');
    } finally {
      saving.current = false;
      if (again.current) doSave();
    }
  }, [id]);
  const changed = useCallback(() => {
    setSave('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(doSave, 1000);
  }, [doSave]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } changed(); }, [meta, title, changed]);
  useEffect(() => {
    const warn = (e) => { if (save !== 'saved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  function updateStats() {
    const el = editRef.current;
    if (!el) return;
    const text = el.innerText || '';
    const words = (text.match(/\S+/g) || []).length;
    const pageH = meta.height;
    setStats({ words, chars: text.replace(/\n/g, '').length, pages: Math.max(1, Math.ceil(el.scrollHeight / pageH)) });
  }

  // ---------- selection ----------
  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection();
      if (!s.rangeCount || !editRef.current) return;
      const r = s.getRangeAt(0);
      if (!editRef.current.contains(r.commonAncestorContainer)) return;
      rangeRef.current = r.cloneRange();
      const node = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      const cs = node ? getComputedStyle(node) : null;
      const block = node?.closest(BLOCKS);
      setFmt({
        bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'), ul: document.queryCommandState('insertUnorderedList'), ol: document.queryCommandState('insertOrderedList'),
        align: cs?.textAlign, font: cs?.fontFamily?.split(',')[0].replace(/["']/g, '').trim(), size: cs ? Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2 : 11,
        block: block?.tagName?.toLowerCase(),
      });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const restore = () => {
    const el = editRef.current;
    el.focus({ preventScroll: true });
    if (rangeRef.current) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(rangeRef.current);
    }
  };
  const exec = (cmd, val = null) => { restore(); document.execCommand(cmd, false, val); afterEdit(); };
  const afterEdit = () => { changed(); updateStats(); };
  const keep = (e) => e.preventDefault(); // toolbar buttons don't steal the cursor
  const insertHtml = (html) => { restore(); document.execCommand('insertHTML', false, html); afterEdit(); };

  function setFontSize(pt) {
    restore();
    document.execCommand('fontSize', false, '7');
    editRef.current.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach((n) => {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;
      span.append(...n.childNodes);
      n.replaceWith(span);
    });
    afterEdit();
  }
  async function setFont(family) {
    if (family === '__google') {
      const name = prompt('Google Font name (for example: Roboto Slab, Nunito, Merriweather)');
      if (!name) return;
      if (!(await loadGoogleFont(name.trim()))) { alert(`Couldn't find “${name}” on Google Fonts.`); return; }
      setMeta((m) => ({ ...m, googleFonts: [...new Set([...(m.googleFonts || []), name.trim()])] }));
      family = name.trim();
    }
    exec('fontName', family);
  }
  function setBlock(tag) {
    exec('formatBlock', tag === 'p' ? 'P' : tag.toUpperCase());
  }
  function setSpacing(v) {
    restore();
    const r = rangeRef.current;
    const blocks = [...editRef.current.querySelectorAll(BLOCKS)].filter((b) => r && r.intersectsNode(b));
    (blocks.length ? blocks : [editRef.current]).forEach((b) => { b.style.lineHeight = v; });
    afterEdit();
  }
  function insertLink() {
    const url = prompt('Link address (https://…)', 'https://');
    if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    const text = rangeRef.current?.toString();
    if (text) exec('createLink', url.trim());
    else insertHtml(`<a href="${url.trim().replace(/"/g, '%22')}">${url.trim().replace(/</g, '&lt;')}</a>`);
  }
  function insertTable() {
    const spec = prompt('Table size (columns x rows)', '3x3');
    const m = spec?.match(/(\d+)\s*[x×*]\s*(\d+)/i);
    if (!m) return;
    const cols = Math.min(12, +m[1]), rows = Math.min(50, +m[2]);
    const head = `<tr>${'<th><br></th>'.repeat(cols)}</tr>`;
    const body = `<tr>${'<td><br></td>'.repeat(cols)}</tr>`.repeat(Math.max(1, rows - 1));
    insertHtml(`<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
  }
  async function insertImageFile(file) {
    if (!file?.type?.startsWith('image/')) return;
    const { src } = await fileToDataUrl(file, 1400);
    insertHtml(`<img src="${src}" alt="">`);
  }
  async function insertPhoto(r) {
    setModal(null);
    const blob = await (await fetch(r.full || `/api/images/${r.id}?full=1`)).blob();
    const { src } = await fileToDataUrl(blob, 1400);
    insertHtml(`<img src="${src}" alt="${(r.title || '').replace(/"/g, '')}">`);
  }
  function checklist() {
    exec('insertUnorderedList');
    const node = window.getSelection().anchorNode;
    const ul = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('ul');
    if (ul) { ul.classList.toggle('checklist'); afterEdit(); }
  }

  // ---------- paste / keys / clicks ----------
  async function onPaste(e) {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); for (const f of files) await insertImageFile(f); return; }
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, cleanHtml(html));
    else if (text) document.execCommand('insertText', false, text);
    afterEdit();
  }
  function onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(timer.current); doSave(); }
    else if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); insertLink(); }
    else if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); setFind({ q: '', r: '', count: 0 }); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')) document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      else document.execCommand('insertText', false, ' ');
      afterEdit();
    }
  }
  function onClick(e) {
    const li = e.target.closest?.('ul.checklist > li');
    if (li && e.clientX - li.getBoundingClientRect().left < 22) { li.classList.toggle('checked'); afterEdit(); }
  }

  // ---------- find & replace ----------
  function countMatches(q) {
    if (!q) return 0;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return ((editRef.current.innerText || '').match(re) || []).length;
  }
  function findNext() {
    if (!find?.q) return;
    editRef.current.focus();
    // window.find is supported by Chrome, Edge, Safari and Firefox.
    if (!window.find(find.q, false, false, true)) { window.getSelection().collapse(editRef.current, 0); window.find(find.q, false, false, true); }
  }
  function replaceAll() {
    if (!find?.q) return;
    const re = new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walker = document.createTreeWalker(editRef.current, NodeFilter.SHOW_TEXT);
    let n = 0;
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((t) => { const v = t.nodeValue.replace(re, () => { n++; return find.r; }); if (v !== t.nodeValue) t.nodeValue = v; });
    setFind({ ...find, count: 0, done: n });
    afterEdit();
  }

  // ---------- import ----------
  async function importFile(file) {
    if (!file) return;
    let html = '';
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.docx')) {
        const mammoth = await import('mammoth/mammoth.browser');
        const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        html = res.value;
      } else if (/\.html?$/.test(name)) html = await file.text();
      else if (/\.(md|markdown)$/.test(name)) html = markdownToHtml(await file.text());
      else html = textToHtml(await file.text());
    } catch (e) {
      alert(`Could not import that file: ${e.message}`);
      return;
    }
    const clean = cleanHtml(html);
    if (confirm('Replace the whole document with this file?\n\nOK = replace · Cancel = insert at the cursor')) {
      editRef.current.innerHTML = clean;
      afterEdit();
    } else insertHtml(clean);
  }

  // ---------- AI ----------
  function openAi(mode) {
    aiRange.current = rangeRef.current?.cloneRange() || null;
    setAi(mode);
  }
  async function applyAi(reply) {
    const html = aiToDocHtml(reply);
    if (!html.trim()) throw new Error('The reply was empty.');
    if (ai === 'doc' && (!editRef.current.innerText.trim() || confirm('Replace the whole document with what the AI wrote?\n\nOK = replace · Cancel = add at the cursor'))) {
      editRef.current.innerHTML = html;
      afterEdit();
      return;
    }
    if (aiRange.current) rangeRef.current = aiRange.current;
    insertHtml(html);
  }

  // ---------- page setup / export ----------
  const setPage = (patch) => setMeta((m) => normalizeDesign({ ...m, html: editRef.current?.innerHTML || '', page: { ...m.page, ...patch } }));
  const current = () => ({ ...metaRef.current, html: editRef.current?.innerHTML || '' });
  async function print() { clearTimeout(timer.current); await doSave(); window.open(`/d/${id}/print`, '_blank'); }
  async function changeVisibility(v) {
    setVisibility(v);
    await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) });
  }

  const saveLabel = { saved: '✓ Saved', saving: 'Saving…', unsaved: 'Unsaved', error: '⚠ Save failed', toobig: '⚠ Too big (use smaller images)' }[save];
  const B = ({ cmd, val, on, title: t, children }) => (
    <button className={`btn btn-sm ${on ? 'active' : ''}`} title={t} onMouseDown={keep} onClick={() => exec(cmd, val)}>{children}</button>
  );

  return (
    <div className="doc-editor">
      <div className="ed-top">
        <Link href="/" className="btn btn-sm" title="Home">🏠</Link>
        <input className="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Document title" />
        <span className="ed-status" onClick={() => save === 'error' && doSave()}>{saveLabel}</span>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => openAi('doc')}>✨ Write with AI</button>
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()} title="Import .docx, .html, .md or .txt">📥 Import</button>
        <input ref={fileRef} type="file" hidden accept=".docx,.html,.htm,.md,.markdown,.txt" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn btn-sm" onClick={print}>🖨 Print</button>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => setModal(modal === 'download' ? null : 'download')}>⬇ Download</button>
          {modal === 'download' ? (
            <div className="dropdown">
              <button onClick={() => { setModal(null); exportDocWord(current(), title); }}>📝 Word <small>.doc</small></button>
              <button onClick={() => { setModal(null); print(); }}>📄 PDF <small>via print</small></button>
              <button onClick={() => { setModal(null); exportDocHtml(current(), title); }}>🌐 Web page <small>.html</small></button>
              <button onClick={() => { setModal(null); exportDocText(current(), title); }}>📃 Plain text <small>.txt</small></button>
            </div>
          ) : null}
        </div>
        {role === 'owner' ? <button className="btn btn-sm" onClick={async () => { await doSave(); setModal('template'); }}>📌 Template</button> : null}
        <button className="btn btn-sm btn-white" onClick={() => setModal('share')}>🔗 Share</button>
      </div>

      <div className="doc-toolbar">
        <button className="btn btn-sm" title="Undo (Ctrl+Z)" onMouseDown={keep} onClick={() => exec('undo')}>↶</button>
        <button className="btn btn-sm" title="Redo (Ctrl+Y)" onMouseDown={keep} onClick={() => exec('redo')}>↷</button>
        <span className="sep" />
        <select value={STYLES.some(([t]) => t === fmt.block) ? fmt.block : 'p'} onChange={(e) => setBlock(e.target.value)} title="Text style">
          {STYLES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
        </select>
        <select value={fonts.includes(fmt.font) ? fmt.font : ''} onChange={(e) => setFont(e.target.value)} title="Font" style={{ width: 140 }}>
          <option value="" disabled>{fmt.font || 'Font'}</option>
          {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          <option value="__google">➕ Any Google Font…</option>
        </select>
        <select value={SIZES_PT.includes(fmt.size) ? fmt.size : ''} onChange={(e) => setFontSize(Number(e.target.value))} title="Size (pt)">
          <option value="" disabled>{fmt.size || 11}</option>
          {SIZES_PT.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="sep" />
        <B cmd="bold" on={fmt.bold} title="Bold (Ctrl+B)"><b>B</b></B>
        <B cmd="italic" on={fmt.italic} title="Italic (Ctrl+I)"><i>I</i></B>
        <B cmd="underline" on={fmt.underline} title="Underline (Ctrl+U)"><u>U</u></B>
        <B cmd="strikeThrough" on={fmt.strike} title="Strikethrough"><s>S</s></B>
        <B cmd="superscript" title="Superscript">x²</B>
        <B cmd="subscript" title="Subscript">x₂</B>
        <label className="color-btn" title="Text color" onMouseDown={() => { /* keep range */ }}>
          A<i style={{ background: '#e40014' }} />
          <input type="color" defaultValue="#e40014" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
        <label className="color-btn" title="Highlight">
          🖍<i style={{ background: '#fcbb00' }} />
          <input type="color" defaultValue="#fff59d" onChange={(e) => exec('hiliteColor', e.target.value)} />
        </label>
        <span className="sep" />
        <B cmd="justifyLeft" on={fmt.align === 'left' || fmt.align === 'start'} title="Align left">⯇</B>
        <B cmd="justifyCenter" on={fmt.align === 'center'} title="Center">≡</B>
        <B cmd="justifyRight" on={fmt.align === 'right'} title="Align right">⯈</B>
        <B cmd="justifyFull" on={fmt.align === 'justify'} title="Justify">☰</B>
        <select defaultValue="" onChange={(e) => { setSpacing(e.target.value); e.target.value = ''; }} title="Line spacing">
          <option value="" disabled>↕ Spacing</option>
          {SPACING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="sep" />
        <B cmd="insertUnorderedList" on={fmt.ul} title="Bullet list">•≡</B>
        <B cmd="insertOrderedList" on={fmt.ol} title="Numbered list">1.≡</B>
        <button className="btn btn-sm" title="Checklist" onMouseDown={keep} onClick={checklist}>☑</button>
        <B cmd="outdent" title="Decrease indent">⇤</B>
        <B cmd="indent" title="Increase indent">⇥</B>
        <span className="sep" />
        <button className="btn btn-sm" title="Link (Ctrl+K)" onMouseDown={keep} onClick={insertLink}>🔗</button>
        <button className="btn btn-sm" title="Upload image" onMouseDown={keep} onClick={() => imgRef.current?.click()}>🖼</button>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { insertImageFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn btn-sm" title="Search free photos" onMouseDown={keep} onClick={() => setModal('photos')}>🔍</button>
        <button className="btn btn-sm" title="Table" onMouseDown={keep} onClick={insertTable}>▦</button>
        <button className="btn btn-sm" title="Horizontal line" onMouseDown={keep} onClick={() => insertHtml('<hr><p><br></p>')}>―</button>
        <button className="btn btn-sm" title="Page break" onMouseDown={keep} onClick={() => insertHtml('<hr class="page-break"><p><br></p>')}>⤓ Page</button>
        <B cmd="removeFormat" title="Clear formatting">⌫ Tx</B>
        <span className="sep" />
        <button className="btn btn-sm" title="Rewrite the selected text with AI" onMouseDown={keep} onClick={() => openAi('doc-edit')}>✨ Edit with AI</button>
        <button className="btn btn-sm" title="Find & replace (Ctrl+F)" onMouseDown={keep} onClick={() => setFind(find ? null : { q: '', r: '', count: 0 })}>🔎</button>
        <button className="btn btn-sm" title="Page setup" onClick={() => setModal(modal === 'page' ? null : 'page')}>📄 Page</button>
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} title="Zoom">
          {[0.5, 0.75, 0.9, 1, 1.25, 1.5, 2].map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
        </select>
      </div>

      <div className="doc-scroll" style={{ position: 'relative' }}>
        {find ? (
          <div className="doc-find">
            <input placeholder="Find" autoFocus value={find.q} onChange={(e) => setFind({ ...find, q: e.target.value, count: countMatches(e.target.value), done: undefined })} onKeyDown={(e) => e.key === 'Enter' && findNext()} />
            <span className="small muted">{find.q ? `${find.count} found` : ''}{find.done != null ? `${find.done} replaced` : ''}</span>
            <button className="btn btn-sm" onClick={findNext}>Next</button>
            <input placeholder="Replace with" value={find.r} onChange={(e) => setFind({ ...find, r: e.target.value })} />
            <button className="btn btn-sm" onClick={replaceAll} disabled={!find.q}>Replace all</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setFind(null)}>✕</button>
          </div>
        ) : null}
        {modal === 'page' ? (
          <div className="doc-find" style={{ left: 18, right: 'auto' }}>
            <select value={meta.page.size} onChange={(e) => setPage({ size: e.target.value })}>
              {Object.entries(DOC_SIZES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
            <select value={meta.page.orientation} onChange={(e) => setPage({ orientation: e.target.value })}>
              <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
            </select>
            <label className="small row" style={{ gap: 4 }}>Margins
              <select value={margin} onChange={(e) => setPage({ margin: Number(e.target.value) })}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((m) => <option key={m} value={m}>{m} in</option>)}
              </select>
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
          </div>
        ) : null}
        <div style={{ zoom }}>
          <div
            ref={editRef}
            className="doc-paper doc-content doc-editable"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={afterEdit}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onClick={onClick}
            onDrop={(e) => { const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); insertImageFile(f); } }}
            style={{
              width: meta.width, minHeight: meta.height, padding: `${margin * 96}px`,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${meta.height - 1}px, #c9cdd4 ${meta.height - 1}px, #c9cdd4 ${meta.height}px)`,
            }}
          />
        </div>
      </div>

      <div className="doc-status">
        <span>{stats.pages} page{stats.pages > 1 ? 's' : ''}</span>
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.chars.toLocaleString()} characters</span>
        <span className="grow" />
        <span>{DOC_SIZES[meta.page.size]?.name} · {meta.page.orientation} · {margin} in margins</span>
      </div>

      {modal === 'share' ? <ShareModal id={id} title={title} role={role} visibility={visibility} onVisibility={changeVisibility} onClose={() => setModal(null)} onPrint={print} /> : null}
      {modal === 'template' ? <SaveTemplate id={id} title={title} onClose={() => setModal(null)} /> : null}
      {modal === 'photos' ? (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal"><div className="modal-head"><h3>Insert a photo</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button></div>
            <div className="modal-body"><ImageSearch onPick={(r) => insertPhoto(r)} /></div>
          </div>
        </div>
      ) : null}
      {ai ? (
        <AiHelper
          mode={ai}
          context={{ title, text: aiRange.current?.toString() || '' }}
          onApply={applyAi}
          onClose={() => setAi(null)}
        />
      ) : null}
    </div>
  );
}
