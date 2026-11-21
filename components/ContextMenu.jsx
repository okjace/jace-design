'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const QUICK = ['#ffffff', '#16181d', '#1f9d5a', '#3ddc84', '#155dfc', '#e40014', '#f99c00', '#fcbb00', '#7c3aed', '#ec4899'];

// The editor's right-click menu. `el` is the element under the pointer (or null for the page).
export default function ContextMenu({ x, y, el, page, colors, fonts = [], hasClip, act, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]);

  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); window.removeEventListener('blur', onClose); };
  }, [onClose]);

  const run = (fn) => () => { fn(); onClose(); };
  const swatches = [...new Set([...(colors || []), ...QUICK])].slice(0, 16);
  const bg = page?.background || {};

  const Item = ({ icon, label, onClick, kbd, danger, disabled }) => (
    <button className={`ctx-item ${danger ? 'danger' : ''}`} disabled={disabled} onClick={run(onClick)}>
      <span className="ctx-ico">{icon}</span><span className="grow">{label}</span>{kbd ? <kbd>{kbd}</kbd> : null}
    </button>
  );
  const Swatches = ({ value, onPick }) => (
    <div className="ctx-swatches">
      {swatches.map((c) => <button key={c} title={c} className={value?.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} />)}
      <label title="Custom color" className="ctx-custom">
        🎨<input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );

  return (
    <div className="ctx-menu" ref={ref} style={pos} onContextMenu={(e) => e.preventDefault()}>
      {el ? (
        <>
          <Item icon="⧉" label="Copy" kbd="Ctrl+C" onClick={act.copy} />
          <Item icon="📋" label="Paste" kbd="Ctrl+V" onClick={act.paste} disabled={!hasClip} />
          <Item icon="⧉" label="Duplicate" kbd="Ctrl+D" onClick={act.duplicateSel} />
          <div className="ctx-sep" />

          {el.type === 'text' ? (
            <>
              <Item icon="✏️" label="Edit text" kbd="Enter" onClick={act.editText} />
              <Item icon="✨" label="Rewrite with AI" onClick={() => act.ai('text')} />
              <div className="ctx-label">Font</div>
              <div className="ctx-row">
                <select
                  className="input"
                  value={el.fontFamily}
                  onChange={(e) => act.font(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 13, fontFamily: `"${el.fontFamily}"` }}
                >
                  {[...new Set([...fonts, el.fontFamily])].map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>)}
                </select>
              </div>
              <div className="ctx-label">Text color</div>
              <Swatches value={el.color} onPick={(c) => act.update({ color: c })} />
              <div className="ctx-row">
                <button className={`btn btn-sm ${el.fontWeight >= 700 ? 'active' : ''}`} onClick={() => act.update({ fontWeight: el.fontWeight >= 700 ? 400 : 700 })}><b>B</b></button>
                <button className={`btn btn-sm ${el.italic ? 'active' : ''}`} onClick={() => act.update({ italic: !el.italic })}><i>I</i></button>
                <button className={`btn btn-sm ${el.underline ? 'active' : ''}`} onClick={() => act.update({ underline: !el.underline })}><u>U</u></button>
                <button className="btn btn-sm" title="Smaller" onClick={() => act.update({ fontSize: Math.max(4, el.fontSize / 1.15) })}>A−</button>
                <button className="btn btn-sm" title="Bigger" onClick={() => act.update({ fontSize: el.fontSize * 1.15 })}>A+</button>
              </div>
              <div className="ctx-sep" />
            </>
          ) : null}

          {el.type === 'image' ? (
            <>
              <Item icon="🖼" label="Make image the background" onClick={() => act.toBackground(el)} />
              <Item icon="🔁" label="Replace image" onClick={act.replace} />
              <Item icon="⇋" label="Flip horizontally" onClick={() => act.update({ flipX: !el.flipX })} />
              <Item icon="⇵" label="Flip vertically" onClick={() => act.update({ flipY: !el.flipY })} />
              <Item icon="⬛" label={el.fit === 'contain' ? 'Fill the frame' : 'Fit whole image'} onClick={() => act.update({ fit: el.fit === 'contain' ? 'cover' : 'contain' })} />
              <Item icon="◐" label="Black & white" onClick={() => act.update({ filters: { ...(el.filters || {}), grayscale: el.filters?.grayscale ? 0 : 100 } })} />
              <div className="ctx-sep" />
            </>
          ) : null}

          {el.type === 'shape' ? (
            <>
              <div className="ctx-label">Fill color</div>
              <Swatches value={el.fill} onPick={(c) => act.update({ fill: c })} />
              <div className="ctx-sep" />
            </>
          ) : null}
          {el.type === 'line' ? (
            <>
              <div className="ctx-label">Line color</div>
              <Swatches value={el.stroke} onPick={(c) => act.update({ stroke: c })} />
              <div className="ctx-sep" />
            </>
          ) : null}

          <div className="ctx-label">Transparency · {Math.round((1 - (el.opacity ?? 1)) * 100)}%</div>
          <div className="ctx-row">
            <input type="range" min={0} max={100} value={Math.round((1 - (el.opacity ?? 1)) * 100)} style={{ width: '100%', accentColor: 'var(--brand)' }}
              onChange={(e) => act.update({ opacity: 1 - Number(e.target.value) / 100 })} />
          </div>
          <div className="ctx-row">
            {[0, 25, 50, 75].map((t) => <button key={t} className="btn btn-sm" onClick={() => act.update({ opacity: 1 - t / 100 })}>{t}%</button>)}
          </div>
          <div className="ctx-sep" />

          <Item icon="⤒" label="Bring to front" kbd="Ctrl+Shift+]" onClick={() => act.reorder('front')} />
          <Item icon="↑" label="Bring forward" kbd="Ctrl+]" onClick={() => act.reorder('up')} />
          <Item icon="↓" label="Send backward" kbd="Ctrl+[" onClick={() => act.reorder('down')} />
          <Item icon="⤓" label="Send to back" kbd="Ctrl+Shift+[" onClick={() => act.reorder('back')} />
          <Item icon="⊕" label="Center on page" onClick={() => { act.alignSel('center'); act.alignSel('middle'); }} />
          <div className="ctx-sep" />
          <Item icon={el.locked ? '🔓' : '🔒'} label={el.locked ? 'Unlock' : 'Lock'} onClick={() => act.update({ locked: !el.locked })} />
          <Item icon="🙈" label="Hide" onClick={() => act.update({ hidden: true })} />
          <Item icon="🗑" label="Delete" kbd="Del" danger onClick={act.deleteSel} />
        </>
      ) : (
        <>
          <Item icon="📋" label="Paste" kbd="Ctrl+V" onClick={act.paste} disabled={!hasClip} />
          <Item icon="☁️" label="Upload an image" onClick={act.upload} />
          <div className="ctx-sep" />
          <div className="ctx-label">Background color</div>
          <Swatches value={bg.type === 'color' ? bg.color : ''} onPick={(c) => act.setBg({ type: 'color', color: c })} />
          {bg.type === 'image' ? (
            <>
              <div className="ctx-label">Background photo transparency · {Math.round((1 - (bg.opacity ?? 1)) * 100)}%</div>
              <div className="ctx-row">
                <input type="range" min={0} max={100} value={Math.round((1 - (bg.opacity ?? 1)) * 100)} style={{ width: '100%', accentColor: 'var(--brand)' }}
                  onChange={(e) => act.setBg({ ...bg, opacity: 1 - Number(e.target.value) / 100 })} />
              </div>
              <Item icon="✋" label="Make background a movable photo" onClick={act.bgToImage} />
              <Item icon="✕" label="Remove background photo" onClick={() => act.setBg({ type: 'color', color: bg.color || '#ffffff' })} />
            </>
          ) : null}
          <div className="ctx-sep" />
          <Item icon="✨" label="Redesign page with AI" onClick={() => act.ai('page')} />
          <Item icon="🎨" label="New color palette (AI)" onClick={() => act.ai('palette')} />
          <div className="ctx-sep" />
          <Item icon="＋" label="Add page" onClick={act.addPage} />
          <Item icon="⧉" label="Duplicate page" onClick={act.dupPage} />
          <Item icon="🗑" label="Delete page" danger disabled={!act.canDeletePage} onClick={act.delPage} />
        </>
      )}
    </div>
  );
}
