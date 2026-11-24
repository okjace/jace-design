'use client';
import { useEffect, useRef, useState } from 'react';

const RATIOS = [['Free', 0], ['Original', -1], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16]];

/** Crop a photo by dragging a box over it. onApply({ crop, natW, natH }) with crop as fractions { x, y, w, h }. */
export default function CropModal({ src, initial, onApply, onReset, onClose }) {
  const [nat, setNat] = useState(null);
  const [box, setBox] = useState(initial || { x: 0, y: 0, w: 1, h: 1 });
  const [ratio, setRatio] = useState(0);
  const areaRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.src = src;
  }, [src]);

  // Keep the box inside the picture (and at the chosen shape).
  const fix = (b, byHeight) => {
    let { x, y, w, h } = b;
    w = Math.max(0.03, Math.min(1, w)); h = Math.max(0.03, Math.min(1, h));
    if (ratio && nat) {
      const want = (ratio === -1 ? nat.w / nat.h : ratio) * (nat.h / nat.w); // width/height of the box in fractions
      if (byHeight) w = h * want; else h = w / want;
      if (w > 1) { w = 1; h = w / want; }
      if (h > 1) { h = 1; w = h * want; }
    }
    return { x: Math.max(0, Math.min(1 - w, x)), y: Math.max(0, Math.min(1 - h, y)), w, h };
  };
  useEffect(() => { setBox((b) => fix(b)); }, [ratio, nat]); // eslint-disable-line react-hooks/exhaustive-deps

  function drag(e, mode) {
    e.preventDefault(); e.stopPropagation();
    const r = areaRef.current.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, b: box };
    const move = (ev) => {
      const dx = (ev.clientX - start.px) / r.width, dy = (ev.clientY - start.py) / r.height;
      const b = { ...start.b };
      if (mode === 'move') { b.x += dx; b.y += dy; setBox(fix(b)); return; }
      if (mode.includes('w')) { b.x += dx; b.w -= dx; }
      if (mode.includes('e')) b.w += dx;
      if (mode.includes('n')) { b.y += dy; b.h -= dy; }
      if (mode.includes('s')) b.h += dy;
      setBox(fix(b, mode === 'n' || mode === 's'));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(760px, 100%)' }}>
        <div className="modal-head"><h3>✂️ Crop photo</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="toggle-row">
            {RATIOS.map(([l, v]) => <button key={l} className={`btn ${ratio === v ? 'active' : ''}`} onClick={() => setRatio(v)}>{l}</button>)}
          </div>
          <div className="crop-stage">
            {nat ? (
              <div className="crop-area" ref={areaRef} style={{ aspectRatio: `${nat.w} / ${nat.h}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" draggable={false} />
                <div className="crop-box" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} onPointerDown={(e) => drag(e, 'move')}>
                  {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((h) => <span key={h} className={`crop-h ${h}`} onPointerDown={(e) => drag(e, h)} />)}
                </div>
              </div>
            ) : <p className="muted">Loading the photo…</p>}
          </div>
          <div className="row">
            {onReset && initial ? <button className="btn" onClick={() => { onReset(); onClose(); }}>Show the whole photo</button> : null}
            <div className="grow" />
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!nat} onClick={() => { onApply({ crop: box, natW: nat.w, natH: nat.h }); onClose(); }}>Crop</button>
          </div>
        </div>
      </div>
    </div>
  );
}
