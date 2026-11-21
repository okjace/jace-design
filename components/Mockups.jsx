'use client';
import { useEffect, useRef, useState } from 'react';
import { downloadBlob, renderPageToCanvas, safeName } from '@/lib/export';

// Show a design on a phone, laptop, tablet, framed poster, T-shirt or printed card.
// Everything is drawn here (no stock photos), so it works offline and downloads as a PNG.
const MOCKS = [
  ['phone', '📱 Phone'], ['laptop', '💻 Laptop'], ['tablet', '📲 Tablet'], ['poster', '🖼 Poster'], ['shirt', '👕 T-shirt'], ['print', '🗒 Print'],
];
const BGS = ['#e9eef2', '#f6e7d8', '#dfe9e1', '#1d2129', '#f3d9e4', '#ffffff'];
const OUT_W = 1600, OUT_H = 1200;

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function cover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, r = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > r) { sw = img.height * r; sx = (img.width - sw) / 2; } else { sh = img.width / r; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function fitBox(ratio, maxW, maxH) {
  let w = maxW, h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w, h };
}
const shadow = (ctx, blur = 60, y = 30, a = 0.28) => { ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0; };
const noShadow = (ctx) => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

function drawMock(ctx, kind, art, bg, shirt) {
  const W = OUT_W, H = OUT_H;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const dark = parseInt(bg.slice(1, 3), 16) < 90;
  const ratio = art.width / art.height;

  if (kind === 'phone' || kind === 'tablet') {
    const sr = kind === 'phone' ? 9 / 19.5 : 3 / 4;
    const { w, h } = fitBox(sr, W * 0.6, H * 0.84);
    const pad = kind === 'phone' ? w * 0.045 : w * 0.05;
    const x = (W - w) / 2, y = (H - h) / 2;
    shadow(ctx, 80, 40, 0.35);
    ctx.fillStyle = '#111317'; rr(ctx, x, y, w, h, w * (kind === 'phone' ? 0.14 : 0.07)); ctx.fill();
    noShadow(ctx);
    ctx.strokeStyle = '#3a3f49'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save();
    rr(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, w * (kind === 'phone' ? 0.1 : 0.04)); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    const sw = w - pad * 2, sh = h - pad * 2;
    const fb = fitBox(ratio, sw, sh);
    if (Math.abs(ratio - sr) < 0.25) cover(ctx, art, x + pad, y + pad, sw, sh);
    else ctx.drawImage(art, x + pad + (sw - fb.w) / 2, y + pad + (sh - fb.h) / 2, fb.w, fb.h);
    ctx.restore();
    if (kind === 'phone') { ctx.fillStyle = '#111317'; rr(ctx, x + w / 2 - w * 0.14, y + pad + 10, w * 0.28, w * 0.07, w * 0.035); ctx.fill(); }
    return;
  }

  if (kind === 'laptop') {
    const sr = 16 / 10;
    const { w, h } = fitBox(sr, W * 0.74, H * 0.62);
    const bez = w * 0.03;
    const x = (W - w) / 2, y = H * 0.12;
    shadow(ctx, 70, 30, 0.3);
    ctx.fillStyle = '#1b1e24'; rr(ctx, x, y, w, h + bez, w * 0.025); ctx.fill();
    noShadow(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(x + bez, y + bez, w - bez * 2, h - bez); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    const sw = w - bez * 2, sh = h - bez;
    const fb = fitBox(ratio, sw, sh);
    if (Math.abs(ratio - sr) < 0.3) cover(ctx, art, x + bez, y + bez, sw, sh);
    else ctx.drawImage(art, x + bez + (sw - fb.w) / 2, y + bez + (sh - fb.h) / 2, fb.w, fb.h);
    ctx.restore();
    const by = y + h + bez;
    const g = ctx.createLinearGradient(0, by, 0, by + h * 0.07);
    g.addColorStop(0, '#d9dde3'); g.addColorStop(1, '#9aa1ab');
    shadow(ctx, 40, 18, 0.25);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.09, by); ctx.lineTo(x + w * 1.09, by); ctx.lineTo(x + w * 1.05, by + h * 0.07); ctx.lineTo(x - w * 0.05, by + h * 0.07); ctx.closePath(); ctx.fill();
    noShadow(ctx);
    ctx.fillStyle = '#b7bdc6'; rr(ctx, x + w / 2 - w * 0.08, by, w * 0.16, h * 0.022, 6); ctx.fill();
    return;
  }

  if (kind === 'poster') {
    // A framed print on a wall, with a little floor line.
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, H * 0.86, W, H * 0.14);
    const { w, h } = fitBox(ratio, W * 0.5, H * 0.66);
    const frame = Math.max(14, w * 0.035), mat = w * 0.07;
    const x = (W - w) / 2, y = H * 0.42 - h / 2;
    shadow(ctx, 50, 24, 0.33);
    ctx.fillStyle = '#16181d'; ctx.fillRect(x - mat - frame, y - mat - frame, w + (mat + frame) * 2, h + (mat + frame) * 2);
    noShadow(ctx);
    ctx.fillStyle = '#fbfbf8'; ctx.fillRect(x - mat, y - mat, w + mat * 2, h + mat * 2);
    ctx.drawImage(art, x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    return;
  }

  if (kind === 'shirt') {
    const s = Math.min(W, H) / 1000 * 1.05;
    const ox = (W - 1000 * s) / 2, oy = (H - 1000 * s) / 2 + 20;
    const P = (px, py) => [ox + px * s, oy + py * s];
    ctx.save();
    shadow(ctx, 60, 30, 0.25);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    const pts = [[330, 110], [410, 80], [590, 80], [670, 110], [880, 250], [800, 400], [720, 350], [725, 930], [275, 930], [280, 350], [200, 400], [120, 250]];
    pts.forEach(([a, b], i) => { const [px, py] = P(a, b); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath(); ctx.fill();
    noShadow(ctx);
    // Collar
    ctx.beginPath(); const [c1x, c1y] = P(410, 80); ctx.moveTo(c1x, c1y);
    const [cqx, cqy] = P(500, 175); const [c2x, c2y] = P(590, 80);
    ctx.quadraticCurveTo(cqx, cqy, c2x, c2y);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 10 * s; ctx.stroke();
    // Print on the chest
    const box = fitBox(ratio, 300 * s, 360 * s);
    const [cx, cy] = P(500, 420);
    ctx.globalCompositeOperation = parseInt(shirt.slice(1, 3), 16) > 128 ? 'multiply' : 'source-over';
    ctx.globalAlpha = 0.95;
    ctx.drawImage(art, cx - box.w / 2, cy - box.h / 2, box.w, box.h);
    ctx.restore();
    // Soft folds
    const g = ctx.createLinearGradient(...P(280, 0), ...P(720, 0));
    g.addColorStop(0, 'rgba(0,0,0,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = g;
    ctx.beginPath(); pts.forEach(([a, b], i) => { const [px, py] = P(a, b); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.closePath(); ctx.fill();
    return;
  }

  // print: the page lying on a desk, slightly turned, with a shadow
  const { w, h } = fitBox(ratio, W * 0.56, H * 0.72);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.06);
  shadow(ctx, 40, 22, 0.3);
  ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -h / 2, w, h);
  noShadow(ctx);
  ctx.drawImage(art, -w / 2, -h / 2, w, h);
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

export default function Mockups({ design, title, pageIndex = 0, onAddPage, onClose }) {
  const [kind, setKind] = useState('phone');
  const [bg, setBg] = useState(BGS[0]);
  const [shirt, setShirt] = useState('#ffffff');
  const [pi, setPi] = useState(pageIndex);
  const [art, setArt] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    setArt(null);
    const s = Math.min(3, 1400 / Math.max(design.width, design.height));
    renderPageToCanvas(design, design.pages[pi], s).then((c) => alive && setArt(c)).catch(() => {});
    return () => { alive = false; };
  }, [design, pi]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !art) return;
    c.width = OUT_W; c.height = OUT_H;
    drawMock(c.getContext('2d'), kind, art, bg, shirt);
  }, [art, kind, bg, shirt]);

  const blob = () => new Promise((r) => ref.current.toBlob(r, 'image/png'));

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(980px, 100%)' }}>
        <div className="modal-head"><h3>📱 Mockups</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="toggle-row">
            {MOCKS.map(([k, n]) => <button key={k} className={`btn ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{n}</button>)}
          </div>
          <div className="mock-stage">
            {art ? null : <p className="muted">Getting the page ready…</p>}
            <canvas ref={ref} style={{ display: art ? 'block' : 'none' }} />
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="small muted">Backdrop</span>
            {BGS.map((c) => <button key={c} className="swatch" style={{ background: c, width: 26, height: 26, outline: bg === c ? '2px solid var(--brand)' : 'none' }} onClick={() => setBg(c)} />)}
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
            {kind === 'shirt' ? (
              <>
                <span className="small muted" style={{ marginLeft: 8 }}>Shirt</span>
                {['#ffffff', '#16181d', '#1f9d5a', '#155dfc', '#e40014', '#f4d35e'].map((c) => <button key={c} className="swatch" style={{ background: c, width: 26, height: 26, outline: shirt === c ? '2px solid var(--brand)' : 'none' }} onClick={() => setShirt(c)} />)}
              </>
            ) : null}
            {design.pages.length > 1 ? (
              <label className="small" style={{ marginLeft: 'auto' }}>Page{' '}
                <select value={pi} onChange={(e) => setPi(Number(e.target.value))}>
                  {design.pages.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className="row wrap">
            <div className="grow" />
            {onAddPage ? <button className="btn" disabled={!art} onClick={async () => { onAddPage(ref.current.toDataURL('image/jpeg', 0.9), OUT_W, OUT_H); onClose(); }}>Add to this design</button> : null}
            <button className="btn btn-primary" disabled={!art} onClick={async () => downloadBlob(await blob(), `${safeName(title)}-${kind}-mockup.png`)}>⬇ Download PNG</button>
          </div>
        </div>
      </div>
    </div>
  );
}
