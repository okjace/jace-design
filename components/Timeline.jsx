'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DesignPage from './DesignPage';
import { videoLength } from '@/lib/design';

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const elName = (e) => (e.type === 'text' ? e.text.slice(0, 24) || 'Text' : e.type === 'image' ? (e.icon ? 'Icon' : 'Photo') : e.type === 'shape' ? e.shape : e.type);
const sceneStart = (design, i) => design.pages.slice(0, i).reduce((s, p) => s + (Number(p.duration) || 3), 0);

/** Draws one moment of the video over the editor canvas (shown while playing or scrubbing). */
function FrameCanvas({ design, t, width, height }) {
  const ref = useRef(null);
  const ready = useRef(null);
  const busy = useRef(false);
  const want = useRef(t);
  want.current = t;
  useEffect(() => {
    ready.current = (async () => {
      const [{ ensureFonts, preloadImages }, { registerFonts }] = await Promise.all([import('@/lib/export'), import('@/lib/fonts')]);
      await registerFonts(design); await ensureFonts(design); await preloadImages(design);
    })();
  }, [design]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
  }, [width, height]);
  useEffect(() => {
    // Draw the newest wanted moment; if the playhead moved while drawing, draw again.
    (async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await ready.current;
        const { drawFrame } = await import('@/lib/video');
        let done = null;
        while (ref.current && done !== want.current) {
          done = want.current;
          const c = ref.current;
          const ctx = c.getContext('2d');
          ctx.save();
          ctx.setTransform(c.width / design.width, 0, 0, c.height / design.height, 0, 0);
          await drawFrame(ctx, design, Math.min(done, Math.max(0, videoLength(design) - 0.001)));
          ctx.restore();
        }
      } finally { busy.current = false; }
    })();
  }, [design, t, width, height]);
  return <canvas ref={ref} className="tl-frame" style={{ width, height }} />;
}

/**
 * The video editor timeline: scenes as clips you can lengthen by dragging, each element's animation as a bar
 * you can move (delay) or stretch (speed), a playhead to scrub, and play/pause right on the canvas.
 */
export default function Timeline({ design, pi, setPi, selId, setSelId, wrapEl, zoom, commit, snapshot, onAddScene }) {
  const total = Math.max(0.5, videoLength(design));
  const [t, setT] = useState(() => sceneStart(design, pi));
  const [preview, setPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [boxW, setBoxW] = useState(800);
  const boxRef = useRef(null);
  const raf = useRef(0);
  const audio = useRef(null);
  const tRef = useRef(t);
  tRef.current = t;
  const LABEL = 110;
  const pps = Math.max(24, Math.min(220, (boxW - LABEL - 24) / total)); // pixels per second
  const page = design.pages[pi];
  const start = sceneStart(design, pi);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pause = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    audio.current?.pause();
  }, []);

  const play = () => {
    if (playing) { pause(); return; }
    let from = tRef.current >= total - 0.05 ? 0 : tRef.current;
    const t0 = performance.now() - from * 1000;
    setPreview(true);
    setPlaying(true);
    if (design.audio?.src) {
      if (!audio.current || audio.current.dataset.src !== design.audio.src.slice(0, 64)) {
        audio.current = new Audio(design.audio.src);
        audio.current.loop = true;
        audio.current.dataset.src = design.audio.src.slice(0, 64);
      }
      audio.current.volume = design.audio.volume ?? 0.8;
      try { audio.current.currentTime = from; } catch {}
      audio.current.play().catch(() => {});
    }
    const tick = () => {
      const now = (performance.now() - t0) / 1000;
      if (now >= total) { setT(total); pause(); return; }
      setT(now);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => { cancelAnimationFrame(raf.current); audio.current?.pause(); }, []);

  // Space plays/pauses (when not typing), Esc goes back to editing.
  useEffect(() => {
    const onKey = (e) => {
      const tg = e.target;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
      if (e.key === ' ') { e.preventDefault(); play(); }
      if (e.key === 'Escape' && preview) { pause(); setPreview(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Keep the scene under the playhead selected while playing/scrubbing.
  useEffect(() => {
    if (!preview) return;
    let s = 0;
    for (let i = 0; i < design.pages.length; i++) {
      const d = Number(design.pages[i].duration) || 3;
      if (t < s + d || i === design.pages.length - 1) { if (i !== pi) setPi(i); break; }
      s += d;
    }
  }, [t, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const xToT = (clientX) => {
    const r = boxRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(total, (clientX - r.left - LABEL + boxRef.current.scrollLeft) / pps));
  };
  function scrub(e) {
    e.preventDefault();
    pause();
    setPreview(true);
    setT(xToT(e.clientX));
    const move = (ev) => setT(xToT(ev.clientX));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Drag helper: calls fn(deltaSeconds) while dragging, with one undo step for the whole drag.
  function drag(e, fn) {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    let first = true;
    const move = (ev) => {
      if (first) { snapshot(); first = false; }
      fn((ev.clientX - x0) / pps);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  const snap = (v) => Math.round(v * 10) / 10;
  const setDuration = (i, v) => commit((d) => ({ ...d, pages: d.pages.map((p, j) => (j === i ? { ...p, duration: Math.min(60, Math.max(0.5, snap(v))) } : p)) }), { history: false });
  const setAnim = (eid, patch) => commit((d) => ({
    ...d, pages: d.pages.map((p, j) => (j === pi ? { ...p, elements: p.elements.map((e) => (e.id === eid ? { ...e, anim: { type: 'fade', delay: 0, duration: 0.7, ...e.anim, ...patch } } : e)) } : p)),
  }), { history: false });

  const ticks = [];
  const every = pps > 90 ? 0.5 : pps > 40 ? 1 : 2;
  for (let s = 0; s <= total + 0.001; s += every) ticks.push(s);
  const width = LABEL + total * pps + 24;
  const thumbH = 34;

  return (
    <div className="timeline">
      <div className="tl-bar">
        <button className="btn btn-sm btn-primary" onClick={play} title="Play / pause (Space)">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <span className="tl-time">{fmt(t)} / {fmt(total)}</span>
        {preview ? <button className="btn btn-sm" onClick={() => { pause(); setPreview(false); }}>✏️ Back to editing</button> : null}
        <div className="grow" />
        <span className="small muted">Drag a scene's edge to change its length · drag a bar to time an animation</span>
        <button className="btn btn-sm" onClick={onAddScene}>＋ Scene</button>
      </div>
      <div className="tl-scroll" ref={boxRef}>
        <div style={{ width, position: 'relative' }}>
          <div className="tl-ruler" style={{ marginLeft: LABEL }} onPointerDown={scrub}>
            {ticks.map((s) => <span key={s} style={{ left: s * pps }}>{Number.isInteger(s) ? `${s}s` : ''}</span>)}
          </div>
          <div className="tl-row">
            <div className="tl-label">🎬 Scenes</div>
            <div className="tl-track" onPointerDown={(e) => e.target === e.currentTarget && scrub(e)}>
              {design.pages.map((p, i) => {
                const d = Number(p.duration) || 3;
                return (
                  <div key={p.id} className={`tl-clip ${i === pi ? 'active' : ''}`} style={{ left: sceneStart(design, i) * pps, width: d * pps - 2 }}
                    onPointerDown={(e) => { e.stopPropagation(); setPi(i); setSelId(null); pause(); setT(sceneStart(design, i)); }}
                    title={`Scene ${i + 1} · ${d}s`}>
                    <div className="tl-thumb"><DesignPage design={design} page={p} width={Math.round((thumbH * design.width) / design.height)} height={thumbH} uidPrefix={`tl${i}-`} /></div>
                    <span className="tl-clip-name">{i + 1} · {d}s</span>
                    <div className="tl-grip" title="Drag to change the length" onPointerDown={(e) => { const d0 = d; drag(e, (ds) => setDuration(i, d0 + ds)); }} />
                  </div>
                );
              })}
            </div>
          </div>
          {design.audio ? (
            <div className="tl-row">
              <div className="tl-label">🎵 Music</div>
              <div className="tl-track"><div className="tl-audio" style={{ width: total * pps - 2 }}>{design.audio.name}</div></div>
            </div>
          ) : null}
          {[...page.elements].reverse().map((e) => {
            const a = e.anim || {};
            const on = a.type && a.type !== 'none';
            const delay = Number(a.delay) || 0;
            const dur = Number(a.duration) || 0.7;
            const sd = Number(page.duration) || 3;
            return (
              <div key={e.id} className={`tl-row tl-el ${e.id === selId ? 'active' : ''}`} onPointerDown={() => setSelId(e.id)}>
                <div className="tl-label" title={elName(e)}>{elName(e)}</div>
                <div className="tl-track">
                  <div className="tl-scene-span" style={{ left: start * pps, width: sd * pps - 2 }} />
                  {on ? (
                    <div className="tl-anim" style={{ left: (start + Math.min(delay, sd)) * pps, width: Math.max(6, dur * pps) }} title={`${a.type} · starts at ${delay}s · takes ${dur}s`}
                      onPointerDown={(ev) => { setSelId(e.id); drag(ev, (ds) => setAnim(e.id, { delay: Math.max(0, Math.min(sd, snap(delay + ds))) })); }}>
                      <span>{a.type}</span>
                      <div className="tl-grip" onPointerDown={(ev) => drag(ev, (ds) => setAnim(e.id, { duration: Math.max(0.1, Math.min(10, snap(dur + ds))) }))} />
                    </div>
                  ) : (
                    <button className="tl-add-anim" style={{ left: start * pps + 4 }} onPointerDown={(ev) => { ev.stopPropagation(); setSelId(e.id); snapshot(); setAnim(e.id, { type: 'fade' }); }}>＋ animate</button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="tl-playhead" style={{ left: LABEL + t * pps }} onPointerDown={scrub} />
        </div>
      </div>
      {preview && wrapEl ? createPortal(
        <div className="tl-preview" onPointerDown={(e) => { e.stopPropagation(); pause(); setPreview(false); }} title="Click to go back to editing">
          <FrameCanvas design={design} t={t} width={design.width * zoom} height={design.height * zoom} />
          {!playing ? <div className="tl-preview-tag">Preview at {fmt(t)} · click to edit</div> : null}
        </div>,
        wrapEl
      ) : null}
    </div>
  );
}
