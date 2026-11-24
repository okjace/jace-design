'use client';
import { useState } from 'react';
import { fileToDataUrl } from '@/lib/export';

const STYLES = [
  ['', 'Any'], ['photo, realistic, high detail', 'Photo'], ['illustration, flat colors', 'Illustration'], ['watercolor painting', 'Watercolor'],
  ['3D render, soft lighting', '3D'], ['anime style', 'Anime'], ['pixel art', 'Pixel art'], ['minimal line art, white background', 'Line art'],
];
const SHAPES = [['square', 1024, 1024, '◼ Square'], ['wide', 1344, 768, '▭ Wide'], ['tall', 768, 1344, '▯ Tall']];

/** Make pictures from a description (AI, free) and add them to the design. onPick({ src, width, height, prompt }). */
export default function AiImage({ onPick, onBackground }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [shape, setShape] = useState('square');
  const [results, setResults] = useState([]); // [{ key, src?, error? }]
  const [busy, setBusy] = useState(false);

  async function make() {
    const [, w, h] = SHAPES.find((s) => s[0] === shape);
    const full = style ? `${prompt.trim()}, ${style}` : prompt.trim();
    setBusy(true);
    const batch = [0, 1].map(() => ({ key: Math.random().toString(36).slice(2), seed: Math.floor(Math.random() * 1e9) }));
    setResults(batch.map((b) => ({ key: b.key })));
    await Promise.all(batch.map(async (b) => {
      try {
        const r = await fetch(`/api/images/generate?prompt=${encodeURIComponent(full)}&w=${w}&h=${h}&seed=${b.seed}`);
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Couldn’t make that picture.');
        const a = await fileToDataUrl(await r.blob(), 1600);
        setResults((list) => list.map((x) => (x.key === b.key ? { ...x, ...a } : x)));
      } catch (e) {
        setResults((list) => list.map((x) => (x.key === b.key ? { ...x, error: e.message } : x)));
      }
    }));
    setBusy(false);
  }

  return (
    <>
      <textarea className="input" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a picture, e.g. a cozy cabin in the snow at night, warm lights" />
      <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
        {STYLES.map(([v, l]) => <button key={l} className={`chip ${style === v ? 'active' : ''}`} onClick={() => setStyle(v)}>{l}</button>)}
      </div>
      <div className="toggle-row" style={{ marginTop: 6 }}>
        {SHAPES.map(([k, , , l]) => <button key={k} className={`btn ${shape === k ? 'active' : ''}`} onClick={() => setShape(k)}>{l}</button>)}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy || prompt.trim().length < 3} onClick={make}>{busy ? '✨ Painting… (10–30 s)' : '✨ Make pictures'}</button>
      <div className="photo-grid" style={{ marginTop: 8 }}>
        {results.map((r) => (
          <div key={r.key} className="photo">
            {r.src ? (
              <>
                <button className="tile" style={{ padding: 0, width: '100%' }} title="Add to the page" onClick={() => onPick({ src: r.src, width: r.width, height: r.height, prompt })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.src} alt={prompt} />
                </button>
                {onBackground ? <button className="btn btn-sm photo-bg" title="Use as background" onClick={() => onBackground(r.src)}>🖼</button> : null}
              </>
            ) : r.error ? <div className="small" style={{ color: 'var(--danger)', padding: 8 }}>{r.error}</div> : <div className="ai-img-wait">✨</div>}
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Pictures are made by a free AI service (Pollinations). Only your description is sent, not who you are.</p>
    </>
  );
}
