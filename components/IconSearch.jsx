'use client';
import { useEffect, useRef, useState } from 'react';

// Free, open-source icon and sticker sets, searched through the public Iconify API.
const SETS = {
  icons: { label: 'Icons', prefixes: 'mdi,lucide,tabler,ph,heroicons,material-symbols', starters: ['star', 'heart', 'home', 'phone', 'mail', 'check', 'arrow', 'music', 'camera', 'user', 'calendar', 'map'] },
  stickers: { label: 'Stickers', prefixes: 'fluent-emoji-flat,noto,twemoji', starters: ['party', 'cat', 'dog', 'pizza', 'rocket', 'sun', 'flower', 'trophy', 'gift', 'cake', 'fire', 'rainbow'] },
};
const API = 'https://api.iconify.design';

const svgUrl = (name, color) => {
  const [prefix, icon] = name.split(':');
  return `${API}/${prefix}/${icon}.svg?width=512&height=512${color ? `&color=${encodeURIComponent(color)}` : ''}`;
};

/** Fetch an icon as a self-contained image (so it works offline, in downloads and in videos). */
export async function iconDataUrl(name, color) {
  const r = await fetch(svgUrl(name, color));
  if (!r.ok) throw new Error('That icon is not available right now.');
  const svg = await r.text();
  if (!svg.trim().startsWith('<svg')) throw new Error('That icon is not available right now.');
  const b64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

export default function IconSearch({ onPick, color = '#16181d' }) {
  const [tab, setTab] = useState('icons');
  const [query, setQuery] = useState('');
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const seq = useRef(0);
  const set = SETS[tab];

  async function search(qs) {
    const term = (qs || '').trim() || set.starters[Math.floor(Math.random() * set.starters.length)];
    const n = ++seq.current;
    setErr(''); setList(null);
    try {
      const r = await fetch(`${API}/search?query=${encodeURIComponent(term)}&limit=96&prefixes=${set.prefixes}`);
      const d = await r.json();
      if (n !== seq.current) return;
      setList(d.icons || []);
    } catch {
      if (n === seq.current) { setErr("Couldn't reach the icon library. Check your connection and try again."); setList([]); }
    }
  }
  useEffect(() => { search(query); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(name) {
    setBusy(name);
    try {
      const mono = tab === 'icons';
      onPick({ src: await iconDataUrl(name, mono ? color : null), icon: name, iconColor: mono ? color : null });
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="toggle-row" style={{ marginBottom: 8 }}>
        {Object.entries(SETS).map(([k, s]) => <button key={k} className={`btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{s.label}</button>)}
      </div>
      <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); search(query); }}>
        <input className="input" placeholder={`Search ${set.label.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} style={{ fontSize: 13 }} />
        <button className="btn btn-sm">Search</button>
      </form>
      <div className="row wrap" style={{ gap: 4, margin: '8px 0' }}>
        {set.starters.slice(0, 8).map((s) => <button key={s} className="chip" onClick={() => { setQuery(s); search(s); }}>{s}</button>)}
      </div>
      {err ? <p className="small muted">{err}</p> : null}
      {!list ? <p className="small muted">Loading…</p> : !list.length && !err ? <p className="small muted">Nothing found. Try another word.</p> : (
        <div className="tile-grid cols-4">
          {list.map((name) => (
            <button key={name} className="tile icon-tile" title={name} disabled={!!busy} onClick={() => pick(name)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgUrl(name, tab === 'icons' ? '#5d6470' : null)} alt={name.split(':')[1]} loading="lazy" style={{ opacity: busy === name ? 0.4 : 1 }} />
            </button>
          ))}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Open-source icons from Material Design, Lucide, Tabler, Phosphor, Heroicons, Fluent Emoji, Noto and Twemoji (via Iconify). Pick an icon, then change its color on the right.</p>
    </>
  );
}
