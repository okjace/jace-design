'use client';
import { useMemo, useState } from 'react';
import DesignPage from './DesignPage';
import { AIS } from '@/lib/ai';
import { CHART_TYPES, chartEl, qrEl, tableEl } from '@/lib/blocks';
import { textEl, shapeEl } from '@/lib/design';
import { askAi, useAiStatus } from '@/lib/aiClient';
import SpellCheck from './SpellCheck';
import AiImage from './AiImage';
import A11yCheck from './A11yCheck';

// Apps that come with Jace Design. Each one gets `api` (what it may do to the design) and `onClose`.
// api: { W, H, k, sel, addEl(el), recolor(colors), setBg(bg), openMockups(), removeBg(), panel(name) }

function Preview({ el, w = 200, h = 200 }) {
  return (
    <div className="app-preview">
      <DesignPage design={{ width: w, height: h }} page={{ id: 'app-prev', background: { type: 'none' }, elements: [{ ...el, x: 0, y: 0, w, h }] }} width="100%" uidPrefix={`ap-${el.type}-`} />
    </div>
  );
}

function QrApp({ api, onClose }) {
  const [text, setText] = useState('https://');
  const [color, setColor] = useState('#000000');
  const [bg, setBg] = useState('#ffffff');
  const el = qrEl({ text: text || ' ', color, bg });
  return (
    <>
      <label className="field">Link or text<input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></label>
      <div className="row" style={{ gap: 12 }}>
        <label className="row small" style={{ gap: 6 }}><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /> Code</label>
        <label className="row small" style={{ gap: 6 }}><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /> Background</label>
      </div>
      <Preview el={el} />
      <button className="btn btn-primary" disabled={!text.trim()} onClick={() => { api.addEl(qrEl({ text, color, bg, w: 360 * api.k, h: 360 * api.k })); onClose(); }}>Add QR code</button>
    </>
  );
}

function AskAiApp({ api, onClose }) {
  const selText = api.sel?.type === 'text' ? api.sel.text : '';
  const [ask, setAsk] = useState(selText ? `Rewrite this to be more catchy: "${selText}"` : '');
  const [answer, setAnswer] = useState('');
  const [ai, setLeft] = useAiStatus();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const prompt = `${ask.trim()}\n\nReply with only the text to put in my design, no extra explanation.`;
  return (
    <>
      <label className="field">What should the AI write?
        <textarea className="input" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. A short, fun headline for a bake sale poster" autoFocus />
      </label>
      {ai.available ? (
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-primary" disabled={!ask.trim() || busy || ai.left === 0} onClick={async () => {
            setBusy(true); setErr('');
            try { const d = await askAi(prompt, { onText: (t) => setAnswer(t) }); setLeft(d.left); setAnswer(d.text.trim()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
          }}>{busy ? '✨ Writing…' : '✨ Write it with Jace AI'}</button>
          <span className="small muted">{typeof ai.left === 'number' ? `${ai.left} left today` : ''}</span>
          {err ? <span className="small" style={{ color: 'var(--danger)' }}>{err}</span> : null}
        </div>
      ) : null}
      <div className="row wrap" style={{ gap: 6 }}>
        {AIS.map((a) => (
          <button key={a.name} className={`btn btn-sm ${a.name === 'ChatGPT' ? 'btn-primary' : ''}`} disabled={!ask.trim()}
            onClick={async () => { try { await navigator.clipboard.writeText(prompt); } catch {} window.open(a.url ? a.url(prompt) : a.home, '_blank', 'noopener'); }}>
            Ask {a.name}
          </button>
        ))}
      </div>
      <div className="small muted">{ai.available ? 'Or ask another AI' : 'Opens in a new tab'} (the question is also copied, so you can paste it){ai.available ? '.' : '. Then paste the answer here:'}</div>
      <textarea className="input" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={ai.available ? 'The answer appears here (you can edit it)' : "Paste the AI's answer"} />
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn btn-primary" disabled={!answer.trim()} onClick={() => { api.addEl(textEl({ text: answer.trim().replace(/^"|"$/g, ''), fontSize: 44 * api.k, w: Math.min(api.W * 0.8, 900 * api.k) })); onClose(); }}>Add as text</button>
        {selText ? <button className="btn" disabled={!answer.trim()} onClick={() => { api.updateSel({ text: answer.trim().replace(/^"|"$/g, '') }); onClose(); }}>Replace the selected text</button> : null}
      </div>
    </>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function CalendarApp({ api, onClose }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [monday, setMonday] = useState(false);
  const [color, setColor] = useState('#1f9d5a');
  const rows = useMemo(() => {
    const days = monday ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const first = new Date(year, month, 1).getDay();
    const offset = monday ? (first + 6) % 7 : first;
    const count = new Date(year, month + 1, 0).getDate();
    const cells = [...Array(offset).fill(''), ...Array.from({ length: count }, (_, i) => String(i + 1))];
    while (cells.length % 7) cells.push('');
    const out = [days];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [month, year, monday]);
  const el = tableEl({ rows, headerBg: color, align: 'center', stripe: '' });
  return (
    <>
      <div className="row wrap" style={{ gap: 8 }}>
        <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 150 }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
        <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} style={{ width: 100 }} />
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={monday} onChange={(e) => setMonday(e.target.checked)} /> Weeks start Monday</label>
        <label className="row small" style={{ gap: 6 }}><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /> Color</label>
      </div>
      <Preview el={el} w={280} h={200} />
      <button className="btn btn-primary" onClick={() => {
        const w = Math.min(api.W * 0.85, 1000 * api.k);
        const h = Math.min(api.H * 0.6, w * 0.7);
        const title = api.addEl(textEl({ text: `${MONTHS[month]} ${year}`, fontFamily: 'Poppins', fontWeight: 700, fontSize: 64 * api.k, w, align: 'center', color }));
        api.addEl({ ...tableEl({ rows, headerBg: color, align: 'center', stripe: '', w, h }), x: title.x, y: title.y + title.h + 16 * api.k }, { center: false });
        onClose();
      }}>Add calendar</button>
    </>
  );
}

// Color harmonies from a starting hue.
const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const f = (n) => { const k = (n + h / 30) % 12; const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
};
function makePalette(kind, h) {
  const r = (a, b) => a + Math.random() * (b - a);
  if (kind === 'mono') return [hsl(h, 30, 96), hsl(h, 45, 80), hsl(h, 60, 55), hsl(h, 70, 35), hsl(h, 60, 15)];
  if (kind === 'complementary') return [hsl(h, 25, 96), hsl(h, 65, 45), hsl(h, 55, 25), hsl((h + 180) % 360, 75, 55), hsl((h + 180) % 360, 80, 85)];
  if (kind === 'triadic') return [hsl(h, 20, 97), hsl(h, 70, 50), hsl((h + 120) % 360, 65, 50), hsl((h + 240) % 360, 70, 55), hsl(h, 40, 15)];
  return [hsl(h, 30, 96), hsl((h + 330) % 360, r(55, 75), 60), hsl(h, r(60, 80), 50), hsl((h + 30) % 360, r(55, 75), 45), hsl(h, 50, 18)];
}
function PaletteApp({ api, onClose }) {
  const [kind, setKind] = useState('analogous');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 360));
  const list = makePalette(kind, seed);
  return (
    <>
      <div className="toggle-row">{['analogous', 'complementary', 'triadic', 'mono'].map((x) => <button key={x} className={`btn ${kind === x ? 'active' : ''}`} onClick={() => setKind(x)}>{x}</button>)}</div>
      <div className="app-palette">{list.map((c) => <div key={c} style={{ background: c }}><span>{c}</span></div>)}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 360))}>🎲 Another one</button>
        <div className="grow" />
        <button className="btn" onClick={() => { list.forEach((c, i) => api.addEl({ ...shapeEl('rect', { fill: c, w: 120 * api.k, h: 120 * api.k, radius: 16 * api.k }), x: api.W / 2 - 330 * api.k + i * 135 * api.k, y: api.H / 2 - 60 * api.k }, { center: false })); onClose(); }}>Add as swatches</button>
        <button className="btn btn-primary" onClick={() => { api.recolor(list); onClose(); }}>Recolor this page</button>
      </div>
    </>
  );
}

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
function PlaceholderApp({ api, onClose }) {
  const [n, setN] = useState(2);
  const [kind, setKind] = useState('sentences');
  const sentences = LOREM.split(/(?<=\.)\s/);
  const text = kind === 'words' ? LOREM.split(' ').slice(0, n * 5).join(' ').replace(/[.,]$/, '') : kind === 'sentences' ? sentences.slice(0, Math.min(n, sentences.length)).join(' ') : Array(n).fill(LOREM).join('\n\n');
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" type="number" min={1} max={8} value={n} onChange={(e) => setN(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} style={{ width: 70 }} />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="words">×5 words</option><option value="sentences">sentences</option><option value="paragraphs">paragraphs</option></select>
      </div>
      <div className="small muted" style={{ maxHeight: 140, overflow: 'auto' }}>{text}</div>
      <button className="btn btn-primary" onClick={() => { api.addEl(textEl({ text, fontSize: 28 * api.k, w: Math.min(api.W * 0.8, 900 * api.k), lineHeight: 1.45 })); onClose(); }}>Add text</button>
    </>
  );
}

function GradientApp({ api, onClose }) {
  const [a, setA] = useState('#7c3aed');
  const [b, setB] = useState('#06b6d4');
  const [angle, setAngle] = useState(135);
  return (
    <>
      <div className="app-gradient" style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }} />
      <div className="row wrap" style={{ gap: 12 }}>
        <label className="row small" style={{ gap: 6 }}><input type="color" value={a} onChange={(e) => setA(e.target.value)} /> From</label>
        <label className="row small" style={{ gap: 6 }}><input type="color" value={b} onChange={(e) => setB(e.target.value)} /> To</label>
        <label className="row small grow" style={{ gap: 6 }}>Angle<input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} style={{ flex: 1 }} /></label>
        <button className="btn btn-sm" onClick={() => { setA(hsl(Math.random() * 360, 75, 55)); setB(hsl(Math.random() * 360, 75, 55)); }}>🎲</button>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <div className="grow" />
        <button className="btn" onClick={() => { api.addEl(shapeEl('rect', { fill: a, gradient: b, gradientAngle: angle, w: 500 * api.k, h: 320 * api.k, radius: 24 * api.k })); onClose(); }}>Add as a shape</button>
        <button className="btn btn-primary" onClick={() => { api.setBg({ type: 'gradient', from: a, to: b, angle }); onClose(); }}>Use as background</button>
      </div>
    </>
  );
}

function ChartApp({ api, onClose }) {
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>Pick a chart. Then type your numbers on the right, like a little spreadsheet.</p>
      <div className="tile-grid">
        {CHART_TYPES.map(([t, n]) => (
          <button key={t} className="tile" title={n} onClick={() => { api.addEl(chartEl(t, { w: Math.min(api.W * 0.8, 900 * api.k), h: Math.min(api.H * 0.7, 560 * api.k) })); onClose(); }}>
            <div style={{ width: '100%' }}><Preview el={chartEl(t, { fontSize: 7 })} w={100} h={90} /></div>
          </button>
        ))}
      </div>
    </>
  );
}

function ActionApp({ run, text }) {
  return <p className="muted" style={{ margin: 0 }}>{text} <button className="btn btn-sm btn-primary" onClick={run}>Open</button></p>;
}

/** Apps that come with Jace Design: [id, icon, name, description, component] */
export const BUILTIN_APPS = [
  { id: 'aiimage', icon: '🎨', name: 'AI image generator', desc: 'Describe a picture and AI paints it', App: ({ api, onClose }) => <AiImage onPick={(a) => { const s2 = Math.min((api.W * 0.6) / a.width, (api.H * 0.6) / a.height); api.addImage(a.src, a.width * s2, a.height * s2); onClose(); }} onBackground={(src) => { api.setBg({ type: 'image', src, color: '#ffffff' }); onClose(); }} /> },
  { id: 'qr', icon: '🔳', name: 'QR code maker', desc: 'Turn a link or text into a QR code', App: QrApp },
  { id: 'chatgpt', icon: '🤖', name: 'AI writer', desc: 'Jace AI writes text for your design (or ask ChatGPT, Claude, Gemini)', App: AskAiApp },
  { id: 'a11y', icon: '🌗', name: 'Accessibility check', desc: 'Find text that is hard to read or too small, and fix it', App: ({ api }) => <A11yCheck api={api} /> },
  { id: 'spelling', icon: '🔤', name: 'Spell check', desc: 'Find and fix spelling mistakes in the whole design', App: ({ api, onClose }) => <SpellCheck api={api} onClose={onClose} /> },
  { id: 'calendar', icon: '📅', name: 'Calendar maker', desc: 'A month calendar as a table', App: CalendarApp },
  { id: 'palette', icon: '🎨', name: 'Color palettes', desc: 'Generate color schemes and recolor a page', App: PaletteApp },
  { id: 'gradient', icon: '🌈', name: 'Gradient maker', desc: 'Make a gradient background or shape', App: GradientApp },
  { id: 'chart', icon: '📊', name: 'Chart maker', desc: 'Bar, line, area, pie and donut charts', App: ChartApp },
  { id: 'lorem', icon: '📝', name: 'Placeholder text', desc: 'Fill space with lorem ipsum while you design', App: PlaceholderApp },
  { id: 'mockups', icon: '📱', name: 'Mockups', desc: 'Show your design on a phone, laptop or T-shirt', run: (api) => api.openMockups() },
  { id: 'bgremove', icon: '✂️', name: 'Background remover', desc: 'Cut the background out of the selected photo', run: (api) => api.removeBg() },
  { id: 'icons', icon: '⭐', name: 'Icons & stickers', desc: 'Thousands of free open-source icons', run: (api) => api.panel('icons') },
];

export { ActionApp };
