'use client';
import { useEffect, useRef, useState } from 'react';
import { fileToDataUrl } from '@/lib/export';

/** Load the signed-in person's brand kit. Returns [brand, save]. */
export function useBrand() {
  const [brand, setBrand] = useState(null);
  useEffect(() => {
    fetch('/api/brand').then((r) => (r.ok ? r.json() : null)).then((d) => setBrand(d?.brand || { colors: [], fonts: [], logos: [] })).catch(() => setBrand({ colors: [], fonts: [], logos: [] }));
  }, []);
  async function save(next) {
    setBrand(next);
    const r = await fetch('/api/brand', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand: next }) });
    if (!r.ok) throw new Error('Could not save your brand kit.');
    const d = await r.json();
    setBrand(d.brand);
  }
  return [brand, save];
}

/**
 * The Brand panel: colors, fonts and logos saved once and usable in every design.
 * onColor(c) applies a color to what's selected (or the background), onFont(f) and onLogo(logo) likewise.
 */
export default function BrandKit({ brand, save, onColor, onFont, onLogo, fonts = [], suggest = [], selType }) {
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState('#1f9d5a');
  const [font, setFont] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);
  if (!brand) return <p className="small muted">Loading your brand kit…</p>;
  const empty = !brand.colors.length && !brand.fonts.length && !brand.logos.length;
  const update = async (patch) => {
    setMsg('');
    try { await save({ ...brand, ...patch }); } catch (e) { setMsg(e.message); }
  };
  const target = selType === 'text' ? 'the text' : selType === 'shape' ? 'the shape' : selType ? 'it' : 'the background';

  return (
    <>
      <div className="row">
        <h4 className="grow" style={{ margin: 0 }}>Brand kit</h4>
        <button className={`btn btn-sm ${edit ? 'active' : ''}`} onClick={() => setEdit(!edit)}>{edit ? 'Done' : '✏️ Edit'}</button>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>Your colors, fonts and logos, ready in every design.{empty && !edit ? ' Press Edit to set them up.' : ''}</p>

      <h4>Colors</h4>
      {brand.colors.length ? (
        <div className="tile-grid cols-6">
          {brand.colors.map((c) => (
            <div key={c} style={{ position: 'relative' }}>
              <button className="swatch" style={{ background: c, width: '100%' }} title={edit ? c : `Use ${c} for ${target}`} onClick={() => !edit && onColor(c)} />
              {edit ? <button className="brand-x" title="Remove" onClick={() => update({ colors: brand.colors.filter((x) => x !== c) })}>✕</button> : null}
            </div>
          ))}
        </div>
      ) : <p className="small muted">No colors yet.</p>}
      {edit ? (
        <>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <input type="color" value={pick} onChange={(e) => setPick(e.target.value)} />
            <button className="btn btn-sm" onClick={() => update({ colors: [...brand.colors, pick] })}>Add color</button>
          </div>
          {suggest.length ? (
            <>
              <div className="small muted" style={{ marginTop: 6 }}>From this design:</div>
              <div className="mini-swatches">
                {suggest.filter((c) => !brand.colors.includes(c)).map((c) => <button key={c} title={`Add ${c}`} style={{ background: c }} onClick={() => update({ colors: [...brand.colors, c] })} />)}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      <h4>Fonts</h4>
      {brand.fonts.length ? brand.fonts.map((f) => (
        <div key={f} className="layer" onClick={() => !edit && onFont(f)} title={edit ? f : selType === 'text' ? `Use ${f} for the text` : `Add text in ${f}`}>
          <span className="name" style={{ fontFamily: `"${f}"`, fontSize: 16 }}>{f}</span>
          {edit ? <button title="Remove" onClick={(e) => { e.stopPropagation(); update({ fonts: brand.fonts.filter((x) => x !== f) }); }}>✕</button> : null}
        </div>
      )) : <p className="small muted">No fonts yet.</p>}
      {edit ? (
        <form className="row" style={{ gap: 6, marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); if (font.trim()) { update({ fonts: [...brand.fonts, font.trim()] }); setFont(''); } }}>
          <input className="input" list="brand-fonts" placeholder="Font name, e.g. Poppins" value={font} onChange={(e) => setFont(e.target.value)} style={{ fontSize: 13 }} />
          <datalist id="brand-fonts">{fonts.map((f) => <option key={f} value={f} />)}</datalist>
          <button className="btn btn-sm" disabled={!font.trim()}>Add</button>
        </form>
      ) : null}

      <h4>Logos</h4>
      {brand.logos.length ? (
        <div className="tile-grid cols-2">
          {brand.logos.map((l) => (
            <div key={l.id} style={{ position: 'relative' }}>
              <button className="tile" style={{ padding: 6, width: '100%' }} title={edit ? l.name : 'Add to page'} onClick={() => !edit && onLogo(l)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt={l.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </button>
              {edit ? <button className="brand-x" title="Remove" onClick={() => update({ logos: brand.logos.filter((x) => x.id !== l.id) })}>✕</button> : null}
            </div>
          ))}
        </div>
      ) : <p className="small muted">No logos yet.</p>}
      {edit ? (
        <>
          <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => fileRef.current?.click()}>⬆️ Upload a logo</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const a = await fileToDataUrl(f, 800);
              if (a.src.length > 680_000) throw new Error('That logo is too big. Try a smaller image (under about 500 KB).');
              update({ logos: [...brand.logos, { id: Math.random().toString(36).slice(2, 10), name: f.name.slice(0, 60), ...a }] });
            } catch (err) { setMsg(err.message || 'Could not add that logo.'); }
          }} />
        </>
      ) : null}
      {msg ? <p className="small" style={{ color: 'var(--danger)' }}>{msg}</p> : null}
    </>
  );
}
