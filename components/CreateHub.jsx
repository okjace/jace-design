'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DOC_SIZES, PRESET_GROUPS, blankDoc, blankPage, blankVideo, imageEl, lineEl, shapeEl, textEl, uid, normalizeDesign } from '@/lib/design';
import { addr, blankSpreadsheet } from '@/lib/sheet';
import { TEMPLATES, templateDesign } from '@/lib/templates';
import { fileToDataUrl } from '@/lib/export';
import { cleanHtml, markdownToHtml, textToHtml } from '@/lib/htmlClean';
import { aiToDesign, aiToDocHtml, extractJson, fillAiImages } from '@/lib/ai';
import DesignPage from './DesignPage';
import AiHelper from './AiHelper';
import { Thumb } from './DesignCard';
import { useCreate } from './useCreate';

const TABS = ['All', 'AI', 'Video', 'Docs', 'More kinds', 'Sizes', 'Templates', 'Import', 'Custom size'];

const VIDEO_SIZES = [
  { name: 'YouTube video', w: 1920, h: 1080, icon: '▶️', note: '16:9' },
  { name: 'Reel / TikTok / Short', w: 1080, h: 1920, icon: '📱', note: '9:16' },
  { name: 'Square video', w: 1080, h: 1080, icon: '⬛', note: '1:1' },
  { name: 'Portrait video', w: 1080, h: 1350, icon: '🖼️', note: '4:5' },
  { name: 'Video ad (landscape)', w: 1280, h: 720, icon: '📣', note: '720p' },
];

// ---------- starters for the other kinds ----------
function whiteboardStarter() {
  const k = 2;
  const note = (text, x, y, color) => textEl({ text, x, y, w: 340 * k / 2, fontFamily: 'Caveat', fontSize: 44, color: '#16181d', bgColor: color, lineHeight: 1.25 });
  return {
    kind: 'whiteboard', width: 3200, height: 2000, assets: [],
    pages: [{ ...blankPage('#f4f5f7'), elements: [
      textEl({ text: 'Brainstorm', x: 120, y: 100, w: 1400, fontFamily: 'Poppins', fontWeight: 700, fontSize: 96, color: '#16181d' }),
      note('Idea one', 140, 320, '#fde047'), note('Idea two', 560, 360, '#93c5fd'), note('Idea three', 980, 300, '#fda4af'),
      note('Question?', 1400, 380, '#86efac'),
    ] }],
  };
}

function connector(a, b, color = '#5d6470') {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const len = Math.hypot(bx - ax, by - ay);
  const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  return lineEl({ x: (ax + bx) / 2 - len / 2, y: (ay + by) / 2 - 6, w: len, h: 12, stroke: color, strokeWidth: 6, rotation: ang });
}

function mindMapStarter() {
  const W = 3200, H = 2000;
  const center = shapeEl('ellipse', { x: W / 2 - 280, y: H / 2 - 140, w: 560, h: 280, fill: '#1f9d5a' });
  const label = (s, text, size = 56, color = '#ffffff') => textEl({ text, x: s.x + 20, y: s.y + s.h / 2 - size * 0.65, w: s.w - 40, fontSize: size, fontFamily: 'Poppins', fontWeight: 700, color, align: 'center' });
  const colors = ['#fde047', '#93c5fd', '#fda4af', '#86efac', '#fdba74', '#d8b4fe'];
  const branches = colors.map((c, i) => {
    const a = (i / colors.length) * Math.PI * 2 - Math.PI / 2;
    return shapeEl('rect', { x: W / 2 + Math.cos(a) * 1050 - 220, y: H / 2 + Math.sin(a) * 620 - 90, w: 440, h: 180, fill: c, radius: 40 });
  });
  return {
    kind: 'whiteboard', width: W, height: H, assets: [],
    pages: [{ ...blankPage('#f4f5f7'), elements: [
      ...branches.map((b) => connector(center, b)),
      center, label(center, 'Main idea', 72),
      ...branches.flatMap((b, i) => [b, label(b, `Topic ${i + 1}`, 48, '#16181d')]),
    ] }],
  };
}

function websiteStarter() {
  const W = 1440, H = 900;
  const T = (o) => textEl({ x: 140, w: W - 280, ...o });
  const button = (text, link, x, y, fill = '#1f9d5a', color = '#ffffff') => [
    { ...shapeEl('rect', { x, y, w: 300, h: 84, fill, radius: 42 }), link },
    { ...T({ text, x, y: y + 20, w: 300, fontSize: 30, fontWeight: 700, color, align: 'center' }), link },
  ];
  return {
    kind: 'website', width: W, height: H, assets: [], site: { title: 'My website', nav: true },
    pages: [
      { ...blankPage(), anchor: 'home', background: { type: 'gradient', from: '#1f9d5a', to: '#0d5c36', angle: 135 }, elements: [
        T({ text: 'Hello, I make things', y: 250, fontFamily: 'Poppins', fontWeight: 700, fontSize: 96, color: '#ffffff' }),
        T({ text: 'A short line about what you do and who it’s for.', y: 400, fontSize: 36, color: '#ffffff', opacity: 0.9 }),
        ...button('About me', '#about', 140, 520, '#ffffff', '#1f9d5a'),
        ...button('Contact', '#contact', 470, 520, 'rgba(255,255,255,0.15)'),
      ] },
      { ...blankPage('#ffffff'), anchor: 'about', elements: [
        T({ text: 'About', y: 140, fontFamily: 'Poppins', fontWeight: 700, fontSize: 72, color: '#16181d' }),
        T({ text: 'Tell your story here. What you do, what you love, and what you’re working on next. Add photos from the Photos tab.', y: 280, w: 760, fontSize: 32, color: '#4b515c', lineHeight: 1.5 }),
        shapeEl('rect', { x: 980, y: 140, w: 320, h: 420, fill: '#e2f4ea', radius: 24 }),
      ] },
      { ...blankPage('#16181d'), anchor: 'contact', elements: [
        T({ text: 'Let’s talk', y: 260, fontFamily: 'Poppins', fontWeight: 700, fontSize: 80, color: '#ffffff', align: 'center' }),
        T({ text: 'hello@example.com', y: 400, fontSize: 36, color: '#3ddc84', align: 'center', link: 'mailto:hello@example.com' }),
        ...button('Email me', 'mailto:hello@example.com', W / 2 - 150, 500),
      ] },
    ],
  };
}

function sheetStarter(kind) {
  const d = blankSpreadsheet();
  const s = d.sheets[0];
  const put = (rows) => rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '' && v != null) s.cells[addr(r, c)] = typeof v === 'object' ? v : { v: String(v) }; }));
  if (kind === 'budget') {
    s.name = 'Budget';
    put([
      [{ v: 'Monthly budget', b: true }],
      [],
      [{ v: 'Category', b: true, bg: '#e2f4ea' }, { v: 'Planned', b: true, bg: '#e2f4ea' }, { v: 'Actual', b: true, bg: '#e2f4ea' }, { v: 'Difference', b: true, bg: '#e2f4ea' }],
      ['Rent', 1200, 1200, { v: '=B4-C4', fmt: 'currency' }],
      ['Groceries', 400, 362.5, { v: '=B5-C5', fmt: 'currency' }],
      ['Transport', 150, 171, { v: '=B6-C6', fmt: 'currency' }],
      ['Fun', 200, 145, { v: '=B7-C7', fmt: 'currency' }],
      ['Savings', 300, 300, { v: '=B8-C8', fmt: 'currency' }],
      [{ v: 'Total', b: true }, { v: '=SUM(B4:B8)', b: true, fmt: 'currency' }, { v: '=SUM(C4:C8)', b: true, fmt: 'currency' }, { v: '=B9-C9', b: true, fmt: 'currency' }],
    ]);
    for (const r of [4, 5, 6, 7, 8]) { s.cells[`B${r}`].fmt = 'currency'; s.cells[`C${r}`].fmt = 'currency'; }
    s.colW = { A: 160 };
  } else if (kind === 'tracker') {
    s.name = 'Tasks';
    put([
      [{ v: 'Task', b: true, bg: '#dbeafe' }, { v: 'Owner', b: true, bg: '#dbeafe' }, { v: 'Due', b: true, bg: '#dbeafe' }, { v: 'Status', b: true, bg: '#dbeafe' }, { v: 'Done?', b: true, bg: '#dbeafe' }],
      ['Write the plan', 'Me', '2026-12-01', 'Done', '=IF(D2="Done","✓","")'],
      ['Design the poster', 'Sam', '2026-12-05', 'Doing', '=IF(D3="Done","✓","")'],
      ['Send invites', 'Riley', '2026-12-10', 'To do', '=IF(D4="Done","✓","")'],
      [],
      [{ v: 'Finished', b: true }, '', '', '', { v: '=COUNTIF_DONE', b: true }],
    ]);
    s.cells.E6 = { v: '=COUNTA(E2:E4)-COUNT(E2:E4)', b: true };
    s.colW = { A: 200 };
  }
  return d;
}

function kanbanStarter() {
  const W = 2400, H = 1500;
  const cols = [['To do', '#fde047'], ['Doing', '#93c5fd'], ['Done', '#86efac']];
  const els = [textEl({ text: 'Project board', x: 80, y: 60, w: 1200, fontFamily: 'Poppins', fontWeight: 700, fontSize: 72, color: '#16181d' })];
  cols.forEach(([name, color], i) => {
    const x = 80 + i * 760;
    els.push(shapeEl('rect', { x, y: 200, w: 700, h: 1220, fill: '#ffffff', radius: 28, stroke: '#dfe2e7', strokeWidth: 3 }));
    els.push(textEl({ text: name, x: x + 40, y: 240, w: 620, fontFamily: 'Poppins', fontWeight: 700, fontSize: 44, color: '#16181d' }));
    [0, 1].forEach((j) => els.push(textEl({ text: `${name} item ${j + 1}`, x: x + 50, y: 360 + j * 200, w: 600, fontFamily: 'Caveat', fontSize: 44, color: '#16181d', bgColor: color })));
  });
  return { kind: 'whiteboard', width: W, height: H, assets: [], pages: [{ ...blankPage('#f4f5f7'), elements: els }] };
}

// A ready-made animated intro, so a new video isn't empty.
function starterVideo(w, h) {
  const k = Math.min(w, h) / 1080;
  const T = (o) => textEl({ align: 'center', x: w * 0.08, w: w * 0.84, color: '#ffffff', ...o });
  const scene = (bg, duration, transition, elements) => ({ ...blankPage(), background: bg, duration, transition, elements });
  return {
    kind: 'video', width: w, height: h, assets: [], fonts: [], googleFonts: [],
    pages: [
      scene({ type: 'gradient', from: '#1f9d5a', to: '#0d5c36', angle: 135 }, 3, 'none', [
        T({ text: 'Your big title', y: h * 0.38, fontFamily: 'Poppins', fontWeight: 700, fontSize: 120 * k, anim: { type: 'pop', delay: 0.2, duration: 0.6 } }),
        T({ text: 'A short line that says more', y: h * 0.38 + 170 * k, fontSize: 48 * k, opacity: 0.9, anim: { type: 'slide-up', delay: 0.7, duration: 0.6 } }),
      ]),
      scene({ type: 'color', color: '#16181d' }, 3, 'slide', [
        T({ text: 'Show what matters', y: h * 0.3, fontFamily: 'Poppins', fontWeight: 700, fontSize: 90 * k, anim: { type: 'typewriter', delay: 0.2, duration: 1.2 } }),
        shapeEl('rect', { x: w / 2 - 60 * k, y: h * 0.3 + 150 * k, w: 120 * k, h: 10 * k, fill: '#3ddc84', radius: 5 * k, anim: { type: 'zoom', delay: 1.4, duration: 0.5 } }),
      ]),
      scene({ type: 'gradient', from: '#3ddc84', to: '#1f9d5a', angle: 160 }, 3, 'fade', [
        T({ text: 'Thanks for watching!', y: h * 0.42, fontFamily: 'Poppins', fontWeight: 700, fontSize: 96 * k, color: '#0c1410', anim: { type: 'zoom', delay: 0.2, duration: 0.7 } }),
      ]),
    ],
  };
}

const DOC_TEMPLATES = [
  { name: 'Blank document', icon: '📄', html: '<h1>Untitled document</h1><p>Start typing…</p>' },
  { name: 'Letter', icon: '✉️', html: '<p>Your Name<br>Street address<br>City, ZIP</p><p>November 20, 2026</p><p>Dear [Name],</p><p>Write your letter here.</p><p>Sincerely,<br>Your Name</p>' },
  { name: 'Resume', icon: '🧑‍💼', html: '<h1>Your Name</h1><p>you@example.com · (555) 010-0100 · City</p><h2>Experience</h2><h3>Job title — Company (2023–now)</h3><ul><li>What you achieved, with numbers</li><li>Another win</li></ul><h2>Education</h2><p>Degree — School (Year)</p><h2>Skills</h2><p>Skill one · Skill two · Skill three</p>' },
  { name: 'Report', icon: '📊', html: '<h1>Report title</h1><p><em>Prepared by Your Name · Date</em></p><h2>Summary</h2><p>The key points in two or three sentences.</p><h2>Findings</h2><table><thead><tr><th>Item</th><th>Result</th><th>Notes</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Next steps</h2><ol><li>First step</li><li>Second step</li></ol>' },
  { name: 'Essay', icon: '📝', html: '<h1 style="text-align: center">Essay title</h1><p style="text-align: center">Your Name · Class · Date</p><p style="line-height: 2">Introduction paragraph…</p><p style="line-height: 2">Body paragraph…</p><p style="line-height: 2">Conclusion…</p>' },
  { name: 'Meeting notes', icon: '🗒️', html: '<h1>Meeting notes</h1><p><strong>Date:</strong> <br><strong>People:</strong> </p><h2>Agenda</h2><ul><li><br></li></ul><h2>Notes</h2><p><br></p><h2>Action items</h2><ul class="checklist"><li>Task — owner</li></ul>' },
  { name: 'To-do list', icon: '✅', html: '<h1>To do</h1><ul class="checklist"><li>First thing</li><li>Second thing</li><li>Third thing</li></ul>' },
];
const UNITS = { px: 1, in: 96, cm: 37.795, mm: 3.7795 };

function PresetShape({ w, h, icon }) {
  const s = 60 / Math.max(w, h);
  return <div className="shape" style={{ width: Math.max(14, w * s), height: Math.max(14, h * s) }}>{w * s > 26 && h * s > 26 ? icon : null}</div>;
}

// Turn a text outline into slides: "# Title" starts a slide, other lines become bullet text.
function outlineToDesign(text, w = 1920, h = 1080) {
  const slides = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s+/.test(line) || (!cur && line.trim())) {
      cur = { title: line.replace(/^#{1,3}\s+/, ''), body: [] };
      slides.push(cur);
    } else if (line.trim()) {
      cur.body.push(line.replace(/^\s*[-*•]\s*/, '• '));
    }
  }
  const palette = [['#1f9d5a', '#0d5c36'], ['#16181d', '#2a2f38'], ['#f093fb', '#f5576c'], ['#43e97b', '#38f9d7']];
  const pages = slides.map((s, i) => {
    const first = i === 0;
    const p = blankPage();
    if (first) {
      p.background = { type: 'gradient', from: palette[0][0], to: palette[0][1], angle: 135 };
      p.elements.push(textEl({ text: s.title, x: w * 0.08, y: h * 0.36, w: w * 0.84, fontFamily: 'Poppins', fontWeight: 700, fontSize: h * 0.11, color: '#ffffff' }));
      if (s.body.length) p.elements.push(textEl({ text: s.body.join('\n').replace(/^• /gm, ''), x: w * 0.08, y: h * 0.56, w: w * 0.84, fontSize: h * 0.045, color: '#ffffff', opacity: 0.9 }));
    } else {
      p.elements.push(textEl({ text: s.title, x: w * 0.08, y: h * 0.1, w: w * 0.84, fontFamily: 'Poppins', fontWeight: 700, fontSize: h * 0.08, color: '#0f172a' }));
      p.elements.push(shapeEl('rect', { x: w * 0.08, y: h * 0.25, w: w * 0.08, h: h * 0.012, fill: '#1f9d5a', radius: 4 }));
      if (s.body.length) p.elements.push(textEl({ text: s.body.join('\n'), x: w * 0.08, y: h * 0.32, w: w * 0.84, fontSize: h * 0.045, color: '#334155', lineHeight: 1.6 }));
    }
    return p;
  });
  return { width: w, height: h, pages: pages.length ? pages : [blankPage()], assets: [] };
}

async function imagesToDesign(files) {
  const imgs = [];
  for (const f of files) imgs.push(await fileToDataUrl(f, 2000));
  const W = imgs[0].width, H = imgs[0].height;
  const pages = imgs.map((img) => {
    const p = blankPage();
    const s = Math.min(W / img.width, H / img.height);
    p.elements.push(imageEl({ src: img.src, w: img.width * s, h: img.height * s, x: (W - img.width * s) / 2, y: (H - img.height * s) / 2 }));
    return p;
  });
  return { width: W, height: H, pages, assets: imgs.map((i) => ({ id: uid(), src: i.src, width: i.width, height: i.height })) };
}

export default function CreateHub() {
  const [tab, setTab] = useState('All');
  const [cat, setCat] = useState('All');
  const { create, createFrom, busy, error } = useCreate();
  const [msg, setMsg] = useState('');
  const [outline, setOutline] = useState('# My presentation\nA subtitle goes here\n\n# First point\n- Something important\n- Another thing\n\n# Thanks!');
  const [link, setLink] = useState('');
  const [custom, setCustom] = useState({ w: 1200, h: 800, unit: 'px', pages: 1 });
  const [drag, setDrag] = useState(false);
  const fileJson = useRef(null);
  const fileImg = useRef(null);
  const fileSlides = useRef(null);
  const show = (t) => tab === 'All' || tab === t;

  async function importFiles(files) {
    setMsg('');
    const list = [...files];
    if (!list.length) return;
    try {
      const json = list.find((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
      if (json) {
        const parsed = JSON.parse(await json.text());
        const design = normalizeDesign(parsed.design || parsed);
        return createFrom(parsed.title || json.name.replace(/(\.jdesign)?\.json$/i, ''), design);
      }
      // PowerPoint: slides with their text, pictures, shapes and tables. PDF: each page becomes a page.
      const pptx = list.find((f) => /\.pptx$/i.test(f.name));
      if (pptx) {
        const { pptxToDesign } = await import('@/lib/importers');
        const d = await pptxToDesign(pptx, { onProgress: setMsg });
        setMsg('Saving…');
        return createFrom(pptx.name.replace(/\.pptx$/i, ''), normalizeDesign({ ...d, assets: [] }));
      }
      const pdf = list.find((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
      if (pdf) {
        const { pdfToPages } = await import('@/lib/importers');
        const d = await pdfToPages(pdf, { onProgress: setMsg, maxPages: 100 });
        setMsg(d.total > d.pages.length ? `Added the first ${d.pages.length} of ${d.total} pages. Saving…` : 'Saving…');
        return createFrom(pdf.name.replace(/\.pdf$/i, ''), normalizeDesign({ width: d.width, height: d.height, pages: d.pages, assets: [] }));
      }
      if (list.some((f) => /\.(ppt|key|odp)$/i.test(f.name))) { setMsg('Save it as .pptx (PowerPoint, Keynote and Google Slides can all do that) or as a PDF, then import that.'); return; }
      const docx = list.find((f) => /\.docx$/i.test(f.name));
      if (docx) {
        const mammoth = await import('mammoth/mammoth.browser');
        const res = await mammoth.convertToHtml({ arrayBuffer: await docx.arrayBuffer() });
        return createFrom(docx.name.replace(/\.docx$/i, ''), blankDoc('letter', cleanHtml(res.value)));
      }
      const page = list.find((f) => /\.html?$/i.test(f.name));
      if (page) return createFrom(page.name.replace(/\.\w+$/, ''), blankDoc('letter', cleanHtml(await page.text())));
      const text = list.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
      if (text) {
        const body = await text.text();
        const html = /\.txt$/i.test(text.name) ? textToHtml(body) : markdownToHtml(body);
        return createFrom(text.name.replace(/\.\w+$/, ''), blankDoc('letter', cleanHtml(html)));
      }
      const images = list.filter((f) => f.type.startsWith('image/'));
      if (images.length) return createFrom(images[0].name.replace(/\.\w+$/, ''), await imagesToDesign(images));
      setMsg('That file type is not supported yet. Try PowerPoint (.pptx), PDF, an image, SVG, Word (.docx), .jdesign.json, .html, .md or .txt file.');
    } catch (e) {
      setMsg(`Could not import that file: ${e.message}`);
    }
  }

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('textarea, input')) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); importFiles(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function importLink() {
    const m = link.match(/\/(?:d|design)\/([A-Za-z0-9]+)/) || link.match(/^([A-Za-z0-9]{8,})$/);
    if (!m) return setMsg('Paste a Jace Design link, like https://…/d/abc123');
    const r = await fetch(`/api/designs/${m[1]}/remix`, { method: 'POST' });
    if (!r.ok) return setMsg("Couldn't open that design. It might be private.");
    const { id } = await r.json();
    location.href = `/design/${id}`;
  }

  // ---- AI ----
  const [ai, setAi] = useState(null); // 'design' | 'doc'
  const [aiSize, setAiSize] = useState('1080x1080');
  const [aiPages, setAiPages] = useState(1);
  const [aiDocSize, setAiDocSize] = useState('letter');
  const [aw, ah] = aiSize.split('x').map(Number);
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('ai');
    if (p === 'design' || p === 'doc') setAi(p);
  }, []);
  async function applyAi(reply, idea, progress) {
    if (ai === 'doc') {
      const html = aiToDocHtml(reply);
      if (!html.trim()) throw new Error('The reply was empty.');
      const firstHeading = html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '');
      await createFrom(firstHeading || idea.slice(0, 60) || 'Document', blankDoc(aiDocSize, html));
      return;
    }
    const { title, design } = aiToDesign(extractJson(reply), aw, ah, ai === 'video' ? 'video' : undefined);
    design.pages = await fillAiImages(design.pages, progress);
    progress?.('Creating your design…');
    await createFrom(title || idea.slice(0, 60) || 'AI design', design);
  }

  // ---- your & community templates ----
  const [tplScope, setTplScope] = useState('builtin');
  const [userTpls, setUserTpls] = useState(null);
  useEffect(() => {
    if (tplScope === 'builtin') return;
    setUserTpls(null);
    fetch(`/api/templates?scope=${tplScope}`).then((r) => r.json()).then((d) => setUserTpls(d.templates || [])).catch(() => setUserTpls([]));
  }, [tplScope]);
  async function openUserTemplate(t) {
    const r = await fetch(`/api/designs/${t.id}/remix`, { method: 'POST' });
    if (r.status === 401) { location.href = '/api/auth/login?next=/new'; return; }
    if (!r.ok) return setMsg("Couldn't use that template.");
    location.href = `/design/${(await r.json()).id}`;
  }

  const cats = ['All', ...new Set(TEMPLATES.map((t) => t.category))];
  // Template previews use random ids, so only render them in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const previews = useMemo(() => (mounted ? Object.fromEntries(TEMPLATES.map((t) => [t.id, templateDesign(t)])) : {}), [mounted]);

  return (
    <main
      className="page"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); importFiles(e.dataTransfer.files); }}
    >
      <h1>Create a design</h1>
      <p className="muted">Pick a size, start from a template, import your own files, or set a custom size. You can also drop or paste files anywhere on this page.</p>
      {error || msg ? <div className="notice err">{error || msg}</div> : null}
      {busy ? <div className="notice ok">Creating your design…</div> : null}
      {drag ? <div className="dropzone">Drop to import ✨</div> : null}
      <div className="ai-banner" onClick={() => setAi('design')}>
        <div style={{ fontSize: 30 }}>✨</div>
        <div className="grow">
          <b>Make a whole design with AI</b>
          <div className="small">Describe it in a sentence: fonts, colors, backgrounds, photos and every page get made for you. Works with any AI.</div>
        </div>
        <span className="btn btn-sm" style={{ background: '#fff', color: '#157a47' }}>Start →</span>
      </div>
      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {show('AI') ? (
        <section>
          <h2>✨ Create with AI</h2>
          <div className="import-grid">
            <div className="import-card" onClick={() => setAi('design')}>
              <div className="ico">🎨</div>
              <div><b>Design with AI</b><div className="muted small">Describe a poster, post, slides or card. Any AI designs it, with real photos filled in.</div></div>
            </div>
            <div className="import-card" onClick={() => setAi('doc')}>
              <div className="ico">📝</div>
              <div><b>Write a document with AI</b><div className="muted small">Letters, essays, reports, resumes — written for you, ready to edit.</div></div>
            </div>
            <div className="import-card" onClick={() => { setAiSize('1920x1080'); setAi('video'); }}>
              <div className="ico">🎬</div>
              <div><b>Make a video with AI</b><div className="muted small">Animated scenes with transitions, ready to play and download as MP4.</div></div>
            </div>
          </div>
          <p className="small muted">Works with ChatGPT, Claude, Gemini, Copilot or any AI you like. No account needed here and it&apos;s free.</p>
        </section>
      ) : null}

      {show('Video') ? (
        <section>
          <h2>🎬 Video</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Scenes with animations, transitions and music. Play it, then download an MP4.</p>
          <div className="preset-grid">
            <button className="preset" disabled={busy} onClick={() => { setAiSize('1920x1080'); setAi('video'); }}>
              <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><div className="shape" style={{ width: 60, height: 34 }}>✨</div></div>
              <b>Video with AI</b><small>Describe it, AI makes the scenes</small>
            </button>
            <button className="preset" disabled={busy} onClick={() => createFrom('Animated intro', starterVideo(1920, 1080))}>
              <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><div className="shape" style={{ width: 60, height: 34 }}>🎉</div></div>
              <b>Animated intro</b><small>3 scenes · ready to edit</small>
            </button>
            {VIDEO_SIZES.map((p) => (
              <button key={p.name} className="preset" disabled={busy} onClick={() => createFrom(p.name, blankVideo(p.w, p.h, 3))}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><PresetShape w={p.w} h={p.h} icon={p.icon} /></div>
                <b>{p.name}</b>
                <small>{p.w} × {p.h} · {p.note}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {show('More kinds') ? (
        <section>
          <h2>🧩 More kinds</h2>
          <div className="preset-grid">
            {[
              ['🧠', 'Whiteboard', 'Sticky notes, pen, shapes', () => createFrom('Whiteboard', whiteboardStarter())],
              ['🕸️', 'Mind map', 'Big idea + branches', () => createFrom('Mind map', mindMapStarter())],
              ['🌐', 'Website', 'Sections + links, published', () => createFrom('My website', websiteStarter())],
              ['📊', 'Spreadsheet', 'Cells & formulas', () => createFrom('Spreadsheet', blankSpreadsheet())],
              ['💰', 'Monthly budget', 'Spreadsheet with totals', () => createFrom('Monthly budget', sheetStarter('budget'))],
              ['✅', 'Task tracker', 'Spreadsheet for to-dos', () => createFrom('Task tracker', sheetStarter('tracker'))],
              ['📋', 'Kanban board', 'To do · Doing · Done', () => createFrom('Kanban board', kanbanStarter())],
            ].map(([icon, name, note, go]) => (
              <button key={name} className="preset" disabled={busy} onClick={go}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><div className="shape" style={{ width: 58, height: 44, fontSize: 24 }}>{icon}</div></div>
                <b>{name}</b>
                <small>{note}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {show('Docs') ? (
        <section>
          <h2>📄 Documents</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Word-style documents you type in: headings, lists, tables, images, page breaks, then print or download as Word or PDF.</p>
          <div className="preset-grid">
            {DOC_TEMPLATES.map((t) => (
              <button key={t.name} className="preset" disabled={busy} onClick={() => createFrom(t.name === 'Blank document' ? 'Untitled document' : t.name, blankDoc('letter', t.html))}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><div className="shape" style={{ width: 46, height: 60 }}>{t.icon}</div></div>
                <b>{t.name}</b>
                <small>Letter · editable</small>
              </button>
            ))}
            {Object.entries(DOC_SIZES).filter(([k]) => k !== 'letter').map(([k, s]) => (
              <button key={k} className="preset" disabled={busy} onClick={() => createFrom('Untitled document', blankDoc(k))}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><PresetShape w={s.w} h={s.h} icon="📄" /></div>
                <b>Blank {k.toUpperCase()}</b>
                <small>{s.name}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {show('Import') ? (
        <section>
          <h2>📥 Import</h2>
          <div className="import-grid">
            <div className="import-card" onClick={() => fileSlides.current?.click()}>
              <div className="ico">📽️</div>
              <div><b>PowerPoint & PDF</b><div className="muted small">.pptx slides become pages you can edit (text, pictures, shapes, tables). Each PDF page becomes a page.</div></div>
            </div>
            <div className="import-card" onClick={() => fileImg.current?.click()}>
              <div className="ico">🖼️</div>
              <div><b>Images & SVGs</b><div className="muted small">PNG, JPG, WebP, GIF or SVG. Pick several to make one page each.</div></div>
            </div>
            <div className="import-card" onClick={() => fileJson.current?.click()}>
              <div className="ico">🗂️</div>
              <div><b>Documents & files</b><div className="muted small">Word (.docx), web pages (.html), Markdown, text — or a .jdesign.json you downloaded.</div></div>
            </div>
            <div className="import-card" style={{ cursor: 'default' }}>
              <div className="ico">🔗</div>
              <div className="grow stack">
                <b>From a link</b>
                <div className="muted small">Make your own copy of any public or shared Jace Design.</div>
                <div className="row"><input className="input" placeholder="https://…/d/abc123" value={link} onChange={(e) => setLink(e.target.value)} /><button className="btn btn-sm" onClick={importLink}>Go</button></div>
              </div>
            </div>
            <div className="import-card" style={{ cursor: 'default' }}>
              <div className="ico">📋</div>
              <div><b>Paste from clipboard</b><div className="muted small">Copy an image or screenshot, then press Ctrl/⌘ + V on this page.</div></div>
            </div>
          </div>
          <input ref={fileImg} type="file" accept="image/*" multiple hidden onChange={(e) => importFiles(e.target.files)} />
          <input ref={fileSlides} type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; importFiles(f); }} />
          <input ref={fileJson} type="file" accept=".json,.docx,.html,.htm,.md,.markdown,.txt" hidden onChange={(e) => importFiles(e.target.files)} />
          <div className="card" style={{ marginTop: 14 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div style={{ fontSize: 28 }}>📝</div>
              <div className="grow stack">
                <b>Outline → presentation</b>
                <div className="muted small">Write or paste an outline. Each “# Heading” becomes a slide and the lines under it become its points.</div>
                <textarea className="input" rows={7} value={outline} onChange={(e) => setOutline(e.target.value)} style={{ fontFamily: 'Fira Code, monospace', fontSize: 13 }} />
                <div><button className="btn btn-primary" disabled={busy} onClick={() => createFrom(outline.match(/^#?\s*(.+)$/m)?.[1]?.slice(0, 80) || 'Presentation', outlineToDesign(outline))}>Make slides</button></div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {show('Sizes') ? (
        <section>
          {PRESET_GROUPS.map((g) => (
            <div key={g.name}>
              <h2>{g.name}</h2>
              <div className="preset-grid">
                {g.items.map((p) => (
                  <button key={p.name} className="preset" disabled={busy} onClick={() => create({ title: p.name, w: p.w, h: p.h, pages: p.pages })}>
                    <div style={{ height: 64, display: 'flex', alignItems: 'center' }}><PresetShape {...p} /></div>
                    <b>{p.name}</b>
                    <small>{p.w} × {p.h}{p.pages ? ` · ${p.pages} pages` : ''}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {show('Templates') ? (
        <section>
          <h2>🧩 Templates</h2>
          <div className="tabs" style={{ marginTop: 0 }}>
            {[['builtin', 'Jace Design'], ['mine', 'Your templates'], ['community', 'Community']].map(([k, l]) => (
              <button key={k} className={`tab ${tplScope === k ? 'active' : ''}`} onClick={() => setTplScope(k)}>{l}</button>
            ))}
          </div>
          {tplScope !== 'builtin' ? (
            !userTpls ? <p className="muted">Loading…</p> : !userTpls.length ? (
              <div className="card center muted">
                {tplScope === 'mine' ? <>No templates yet. Open any design and press <b>📌 Template</b> to save it as one.</> : 'No community templates yet. Be the first: save a design as a template and choose “Community”.'}
              </div>
            ) : (
              <div className="grid">
                {userTpls.map((t) => (
                  <button key={t.id} className="dcard" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => openUserTemplate(t)}>
                    <Thumb data={t.data} uid={`u${t.id}`} thumb={t.thumb} />
                    <span className="dcard-title">{t.title}</span>
                    <span className="dcard-meta">{t.category || (t.data?.kind === 'doc' ? 'Document' : `${t.width} × ${t.height}`)}{tplScope === 'community' ? ` · @${t.username}` : ''}{t.uses ? ` · used ${t.uses}×` : ''}</span>
                  </button>
                ))}
              </div>
            )
          ) : null}
          {tplScope === 'builtin' ? (
          <div className="tabs" style={{ marginTop: 0 }}>
            {cats.map((c) => <button key={c} className={`tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          ) : null}
          <div className="grid">
            {mounted && tplScope === 'builtin' && TEMPLATES.filter((t) => cat === 'All' || t.category === cat).map((t) => {
              const d = previews[t.id];
              return (
                <button key={t.id} className="dcard" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} disabled={busy} onClick={() => createFrom(t.name, templateDesign(t))}>
                  <div className="thumb"><DesignPage design={d} page={d.pages[0]} width="100%" height="100%" uidPrefix={`tpl${t.id}-`} /></div>
                  <span className="dcard-title">{t.name}</span>
                  <span className="dcard-meta">{t.category} · {d.pages.length > 1 ? `${d.pages.length} pages` : `${t.width} × ${t.height}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {show('Custom size') ? (
        <section>
          <h2>📐 Custom size</h2>
          <div className="card row wrap" style={{ alignItems: 'flex-end' }}>
            <label className="field">Width<input className="input" type="number" min="1" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value })} style={{ width: 120 }} /></label>
            <span style={{ paddingBottom: 10 }}>×</span>
            <label className="field">Height<input className="input" type="number" min="1" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value })} style={{ width: 120 }} /></label>
            <label className="field">Units
              <select className="input" value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} style={{ width: 100 }}>
                {Object.keys(UNITS).map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="field">Pages<input className="input" type="number" min="1" max="50" value={custom.pages} onChange={(e) => setCustom({ ...custom, pages: e.target.value })} style={{ width: 90 }} /></label>
            <button className="btn btn-primary" disabled={busy} onClick={() => {
              const w = Math.round(Number(custom.w) * UNITS[custom.unit]);
              const h = Math.round(Number(custom.h) * UNITS[custom.unit]);
              if (!(w >= 16 && h >= 16 && w <= 8000 && h <= 8000)) return setMsg('Size must be between 16 and 8000 pixels on each side.');
              create({ title: `${custom.w} × ${custom.h} ${custom.unit}`, w, h, pages: Math.min(50, Math.max(1, Number(custom.pages) || 1)) });
            }}>Create</button>
          </div>
        </section>
      ) : null}
      {ai ? (
        <AiHelper
          mode={ai}
          context={{ width: aw, height: ah, pages: aiPages }}
          onApply={applyAi}
          onClose={() => setAi(null)}
          extra={ai === 'design' || ai === 'video' ? (
            <div className="row wrap" style={{ gap: 8 }}>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>Size
                <select className="input" value={aiSize} onChange={(e) => setAiSize(e.target.value)}>
                  {(ai === 'video' ? VIDEO_SIZES : PRESET_GROUPS.flatMap((g) => g.items)).map((p) => <option key={p.name} value={`${p.w}x${p.h}`}>{p.name} ({p.w}×{p.h})</option>)}
                </select>
              </label>
              <label className="field">{ai === 'video' ? 'Scenes' : 'Pages'}
                <input className="input" type="number" min={1} max={20} value={aiPages} onChange={(e) => setAiPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 80 }} />
              </label>
            </div>
          ) : (
            <label className="field">Page size
              <select className="input" value={aiDocSize} onChange={(e) => setAiDocSize(e.target.value)}>
                {Object.entries(DOC_SIZES).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
              </select>
            </label>
          )}
        />
      ) : null}
    </main>
  );
}
