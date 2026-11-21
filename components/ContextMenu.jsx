'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import FontPicker from './FontPicker';
import LinkPicker from './LinkPicker';

const QUICK = ['#ffffff', '#16181d', '#1f9d5a', '#3ddc84', '#155dfc', '#e40014', '#f99c00', '#fcbb00', '#7c3aed', '#ec4899'];
const WEIGHTS = [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semi bold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']];

// Small building blocks (defined outside the menu so they don't remount on every change).
function Item({ icon, label, onClick, kbd, danger, disabled }) {
  return (
    <button className={`ctx-item ${danger ? 'danger' : ''}`} disabled={disabled} onClick={onClick}>
      <span className="ctx-ico">{icon}</span><span className="grow">{label}</span>{kbd ? <kbd>{kbd}</kbd> : null}
    </button>
  );
}
function Swatches({ value, onPick, swatches }) {
  return (
    <div className="ctx-swatches">
      {swatches.map((c) => <button key={c} title={c} className={value?.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} />)}
      <label title="Custom color" className="ctx-custom">
        🎨<input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}
function Slider({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <div className="ctx-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="v">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
  );
}
function Icon({ title, onClick, children, danger, active }) {
  return <button className={`ctx-icon ${danger ? 'danger' : ''} ${active ? 'on' : ''}`} title={title} onClick={onClick}>{children}</button>;
}

/** Font & text settings shown when you right-click text. */
function TextSettings({ el, act, swatches, fontInfo }) {
  const sh = el.shadow || {};
  const caseMode = el.uppercase ? 'upper' : el.textCase || 'none';
  return (
    <>
      <div className="ctx-label">Font</div>
      <div className="ctx-row" style={{ display: 'block' }}>
        <FontPicker
          value={el.fontFamily}
          designFonts={fontInfo.designFonts}
          uploaded={fontInfo.uploaded}
          onPick={act.font}
          onUpload={act.uploadFont}
          onAddGoogle={act.addGoogleFont}
          height={200}
        />
      </div>

      <div className="ctx-label">Size & weight</div>
      <div className="ctx-row" style={{ alignItems: 'center' }}>
        <button className="btn btn-sm" title="Smaller" onClick={() => act.update({ fontSize: Math.max(4, Math.round(el.fontSize / 1.1)) })}>A−</button>
        <input className="input" type="number" min={4} value={Math.round(el.fontSize)} onChange={(e) => { const v = Number(e.target.value); if (v >= 1) act.update({ fontSize: v }); }} style={{ width: 66, padding: '5px 6px', fontSize: 13 }} />
        <button className="btn btn-sm" title="Bigger" onClick={() => act.update({ fontSize: Math.round(el.fontSize * 1.1) })}>A+</button>
        <select className="input" value={el.fontWeight || 400} onChange={(e) => act.weight(Number(e.target.value))} style={{ flex: 1, padding: '5px 6px', fontSize: 13 }}>
          {WEIGHTS.map(([w, n]) => <option key={w} value={w}>{n}</option>)}
        </select>
      </div>

      <div className="ctx-row">
        <Icon title="Bold" active={el.fontWeight >= 700} onClick={() => act.weight(el.fontWeight >= 700 ? 400 : 700)}><b>B</b></Icon>
        <Icon title="Italic" active={el.italic} onClick={() => act.update({ italic: !el.italic })}><i>I</i></Icon>
        <Icon title="Underline" active={el.underline} onClick={() => act.update({ underline: !el.underline })}><u>U</u></Icon>
        <Icon title="UPPERCASE" active={caseMode === 'upper'} onClick={() => act.update({ uppercase: caseMode !== 'upper' })}>AA</Icon>
        <span className="ctx-gap" />
        {[['left', '⯇'], ['center', '≡'], ['right', '⯈']].map(([a, i]) => (
          <Icon key={a} title={`Align ${a}`} active={el.align === a} onClick={() => act.update({ align: a })}>{i}</Icon>
        ))}
      </div>

      <Slider label="Letter spacing" value={el.letterSpacing || 0} min={-Math.round(el.fontSize / 10)} max={Math.round(el.fontSize / 2)} onChange={(v) => act.update({ letterSpacing: v })} />
      <Slider label="Line height" value={el.lineHeight || 1.2} min={0.6} max={3} step={0.05} onChange={(v) => act.update({ lineHeight: v })} />

      <div className="ctx-label">Text color</div>
      <Swatches value={el.color} onPick={(c) => act.update({ color: c })} swatches={swatches} />

      <div className="ctx-label">Effects</div>
      <div className="ctx-row">
        <button className={`btn btn-sm ${sh.on ? 'active' : ''}`} onClick={() => act.update({ shadow: { x: el.fontSize / 20, y: el.fontSize / 14, blur: el.fontSize / 8, color: 'rgba(0,0,0,0.4)', ...sh, on: !sh.on } })}>Shadow</button>
        <button className={`btn btn-sm ${el.strokeWidth ? 'active' : ''}`} onClick={() => act.update({ strokeWidth: el.strokeWidth ? 0 : Math.max(1, el.fontSize / 20), stroke: el.stroke || '#000000' })}>Outline</button>
        <button className={`btn btn-sm ${el.bgColor ? 'active' : ''}`} onClick={() => act.update({ bgColor: el.bgColor ? '' : '#fde047' })}>Highlight</button>
      </div>
      {el.strokeWidth ? (
        <>
          <Slider label="Outline" value={el.strokeWidth} min={0.5} max={Math.max(10, Math.round(el.fontSize / 5))} step={0.5} onChange={(v) => act.update({ strokeWidth: v })} />
          <Swatches value={el.stroke} onPick={(c) => act.update({ stroke: c })} swatches={swatches} />
        </>
      ) : null}
      {el.bgColor ? <Swatches value={el.bgColor} onPick={(c) => act.update({ bgColor: c })} swatches={swatches} /> : null}

      <Slider label="Transparency" value={Math.round((1 - (el.opacity ?? 1)) * 100)} min={0} max={100} suffix="%" onChange={(v) => act.update({ opacity: 1 - v / 100 })} />
    </>
  );
}

// The editor's right-click menu. `el` is the element under the pointer (or null for the page).
/** "When clicked, go to" — a page of this website, a web address or an email. */
function LinkSection({ el, act, pages, isSite }) {
  return (
    <>
      <div className="ctx-label">{isSite ? 'When clicked, go to' : 'Link'}</div>
      <div className="ctx-row" style={{ display: 'block' }}>
        <LinkPicker value={el.link || ''} onChange={(link) => act.update({ link })} pages={pages} isSite={isSite} compact />
      </div>
      <div className="ctx-sep" />
    </>
  );
}

export default function ContextMenu({ x, y, el, page, pages = [], isSite = false, colors, fontInfo = { designFonts: [], uploaded: [] }, hasClip, act, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const isText = el?.type === 'text';

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const r = m.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y, isText]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) closeRef.current(); };
    const key = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key); };
  }, []);

  const run = (fn) => () => { fn(); onClose(); };
  const swatches = [...new Set([...(colors || []), ...QUICK])].slice(0, 16);
  const bg = page?.background || {};

  return (
    <div className={`ctx-menu ${isText ? 'wide' : ''}`} ref={ref} style={pos} onContextMenu={(e) => e.preventDefault()}>
      {isText ? (
        <>
          <div className="ctx-row ctx-toolbar">
            <Icon title="Edit text (Enter)" onClick={run(act.editText)}>✏️</Icon>
            <Icon title="Rewrite with AI" onClick={run(() => act.ai('text'))}>✨</Icon>
            <Icon title="Copy (Ctrl+C)" onClick={run(act.copy)}>⧉</Icon>
            <Icon title="Duplicate (Ctrl+D)" onClick={run(act.duplicateSel)}>⊕</Icon>
            <Icon title="Bring to front" onClick={() => act.reorder('front')}>⤒</Icon>
            <Icon title="Send to back" onClick={() => act.reorder('back')}>⤓</Icon>
            <Icon title={el.locked ? 'Unlock' : 'Lock'} active={el.locked} onClick={() => act.update({ locked: !el.locked })}>{el.locked ? '🔒' : '🔓'}</Icon>
            <span className="ctx-gap" />
            <Icon title="Delete" danger onClick={run(act.deleteSel)}>🗑</Icon>
          </div>
          {isSite ? <LinkSection el={el} act={act} pages={pages} isSite={isSite} /> : null}
          <TextSettings el={el} act={act} swatches={swatches} fontInfo={fontInfo} />
          {!isSite ? <LinkSection el={el} act={act} pages={pages} isSite={isSite} /> : null}
        </>
      ) : el ? (
        <>
          <Item icon="⧉" label="Copy" kbd="Ctrl+C" onClick={run(act.copy)} />
          <Item icon="📋" label="Paste" kbd="Ctrl+V" onClick={run(act.paste)} disabled={!hasClip} />
          <Item icon="⊕" label="Duplicate" kbd="Ctrl+D" onClick={run(act.duplicateSel)} />
          <div className="ctx-sep" />

          {el.type === 'image' ? (
            <>
              <Item icon="🖼" label="Make image the background" onClick={run(() => act.toBackground(el))} />
              <Item icon="🔁" label="Replace image" onClick={run(act.replace)} />
              <Item icon="⇋" label="Flip horizontally" onClick={() => act.update({ flipX: !el.flipX })} />
              <Item icon="⇵" label="Flip vertically" onClick={() => act.update({ flipY: !el.flipY })} />
              <Item icon="⬛" label={el.fit === 'contain' ? 'Fill the frame' : 'Fit whole image'} onClick={() => act.update({ fit: el.fit === 'contain' ? 'cover' : 'contain' })} />
              <Item icon="◐" label="Black & white" onClick={() => act.update({ filters: { ...(el.filters || {}), grayscale: el.filters?.grayscale ? 0 : 100 } })} />
              <div className="ctx-sep" />
              <div className="ctx-label">Rounded corners</div>
              <Slider label="Corners" value={Math.round(el.radius || 0)} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v) => act.update({ radius: v })} />
              <div className="ctx-row">
                {[['Square', 0], ['Rounded', 0.08], ['More', 0.2], ['Circle', 0.5]].map(([n, f]) => (
                  <button key={n} className={`btn btn-sm ${Math.round(el.radius || 0) === Math.round(Math.min(el.w, el.h) * f) ? 'active' : ''}`}
                    onClick={() => act.update({ radius: Math.min(el.w, el.h) * f })}>{n}</button>
                ))}
              </div>
              <div className="ctx-sep" />
            </>
          ) : null}
          {el.type === 'shape' ? (
            <>
              <div className="ctx-label">Fill color</div>
              <Swatches value={el.fill} onPick={(c) => act.update({ fill: c })} swatches={swatches} />
              <div className="ctx-sep" />
            </>
          ) : null}
          {el.type === 'line' ? (
            <>
              <div className="ctx-label">Line color</div>
              <Swatches value={el.stroke} onPick={(c) => act.update({ stroke: c })} swatches={swatches} />
              <div className="ctx-sep" />
            </>
          ) : null}

          <LinkSection el={el} act={act} pages={pages} isSite={isSite} />

          <Slider label="Transparency" value={Math.round((1 - (el.opacity ?? 1)) * 100)} min={0} max={100} suffix="%" onChange={(v) => act.update({ opacity: 1 - v / 100 })} />
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
          <Item icon="🙈" label="Hide" onClick={run(() => act.update({ hidden: true }))} />
          <Item icon="🗑" label="Delete" kbd="Del" danger onClick={run(act.deleteSel)} />
        </>
      ) : (
        <>
          <Item icon="📋" label="Paste" kbd="Ctrl+V" onClick={run(act.paste)} disabled={!hasClip} />
          <Item icon="☁️" label="Upload an image" onClick={run(act.upload)} />
          <div className="ctx-sep" />
          <div className="ctx-label">Background color</div>
          <Swatches value={bg.type === 'color' ? bg.color : ''} onPick={(c) => act.setBg({ type: 'color', color: c })} swatches={swatches} />
          {bg.type === 'image' ? (
            <>
              <Slider label="Photo transparency" value={Math.round((1 - (bg.opacity ?? 1)) * 100)} min={0} max={100} suffix="%" onChange={(v) => act.setBg({ ...bg, opacity: 1 - v / 100 })} />
              <Item icon="✋" label="Make background a movable photo" onClick={run(act.bgToImage)} />
              <Item icon="✕" label="Remove background photo" onClick={run(() => act.setBg({ type: 'color', color: bg.color || '#ffffff' }))} />
            </>
          ) : null}
          <div className="ctx-sep" />
          <Item icon="✨" label="Redesign page with AI" onClick={run(() => act.ai('page'))} />
          <Item icon="🪄" label="Redo the whole design with AI" onClick={run(() => act.ai('redo'))} />
          <Item icon="🎨" label="New color palette (AI)" onClick={run(() => act.ai('palette'))} />
          <div className="ctx-sep" />
          <Item icon="＋" label="Add page" onClick={run(act.addPage)} />
          <Item icon="⧉" label="Duplicate page" onClick={run(act.dupPage)} />
          <Item icon="🗑" label="Delete page" danger disabled={!act.canDeletePage} onClick={run(act.delPage)} />
        </>
      )}
    </div>
  );
}
