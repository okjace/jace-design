'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { drawFrame, makeSoundtrack, sceneAt, stopClips, videoLength } from '@/lib/video';
import { ensureFonts, preloadImages } from '@/lib/export';
import { registerFonts } from '@/lib/fonts';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Plays a video design (scenes + animations + music) on a canvas. */
export default function VideoPlayer({ design, autoPlay = false, startAt = 0, onClose, maxHeight = '70vh' }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(startAt);
  const tRef = useRef(startAt);
  const startRef = useRef(0);
  const raf = useRef(0);
  const drawing = useRef(false);
  const total = Math.max(0.1, videoLength(design));

  const paint = useCallback(async (time, live = false) => {
    const c = canvasRef.current;
    if (!c || drawing.current) return;
    drawing.current = true;
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.setTransform(c.width / design.width, 0, 0, c.height / design.height, 0, 0);
    try { await drawFrame(ctx, design, Math.min(time, total - 0.001), { playing: live }); } finally { ctx.restore(); drawing.current = false; }
  }, [design, total]);

  // Size the canvas to its box (sharp on HiDPI screens), and get fonts and images ready.
  useEffect(() => {
    let alive = true;
    (async () => {
      await registerFonts(design);
      await ensureFonts(design);
      await preloadImages(design);
      if (!alive) return;
      setReady(true);
    })();
    return () => { alive = false; };
  }, [design]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const box = c.parentElement.getBoundingClientRect();
      const ratio = design.width / design.height;
      let w = box.width, h = w / ratio;
      const maxH = c.parentElement.clientHeight || h;
      if (h > maxH) { h = maxH; w = h * ratio; }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      paint(tRef.current);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c.parentElement);
    return () => ro.disconnect();
  }, [design, paint, ready]);

  useEffect(() => { if (ready) paint(tRef.current); }, [ready, paint]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    audioRef.current?.pause();
    stopClips();
  }, []);

  const play = useCallback(() => {
    if (tRef.current >= total - 0.05) tRef.current = 0;
    startRef.current = performance.now() - tRef.current * 1000;
    setPlaying(true);
    if (!audioRef.current) audioRef.current = makeSoundtrack(design);
    audioRef.current.play(tRef.current);
    const tick = () => {
      const now = (performance.now() - startRef.current) / 1000;
      if (now >= total) {
        tRef.current = total; setT(total); paint(total); stop();
        return;
      }
      tRef.current = now;
      setT(now);
      audioRef.current?.tick(now);
      paint(now, true);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [design.audio, paint, stop, total]);

  useEffect(() => { if (ready && autoPlay) play(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(raf.current); audioRef.current?.pause(); stopClips(); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? stop() : play(); }
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, play, stop, onClose]);

  function seek(v) {
    const wasPlaying = playing;
    if (wasPlaying) stop();
    tRef.current = v; setT(v); paint(v);
    if (wasPlaying) setTimeout(play, 0);
  }

  const scene = sceneAt(design, Math.min(t, total - 0.001));
  return (
    <div className="video-player">
      <div className="video-stage" style={{ maxHeight }} onClick={() => (playing ? stop() : play())}>
        <canvas ref={canvasRef} />
        {!ready ? <div className="video-loading">Loading…</div> : null}
        {ready && !playing ? <div className="video-big-play">▶</div> : null}
      </div>
      <div className="video-controls">
        <button className="btn btn-sm" onClick={() => (playing ? stop() : play())} disabled={!ready}>{playing ? '⏸' : '▶'}</button>
        <span className="small" style={{ minWidth: 86 }}>{fmt(t)} / {fmt(total)}</span>
        <input type="range" min={0} max={total} step={0.01} value={Math.min(t, total)} onChange={(e) => seek(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand)' }} />
        <span className="small muted">Scene {scene.index + 1}/{design.pages.length}</span>
        {onClose ? <button className="btn btn-sm" onClick={onClose}>✕</button> : null}
      </div>
    </div>
  );
}
