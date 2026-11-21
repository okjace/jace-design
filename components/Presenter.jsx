'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DesignPage from './DesignPage';
import { resolveBg } from '@/lib/blocks';

const animated = (e) => e.anim?.type && e.anim.type !== 'none';
const needsPlay = (page, withTransition) => (withTransition && page.transition && page.transition !== 'none') || page.elements.some(animated);

/** Plays a slide's transition (from the slide before) and its animations on a canvas, then hands back to the sharp SVG. */
function SlidePlayer({ design, from, to, onDone }) {
  const ref = useRef(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let stop = false, raf = 0;
    const c = ref.current;
    const W = design.width, H = design.height;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.style.width = `${W * s}px`; c.style.height = `${H * s}px`;
    c.width = Math.round(W * s * dpr); c.height = Math.round(H * s * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(s * dpr, s * dpr);
    const page = design.pages[to];
    const prev = from != null ? design.pages[from] : null;
    // Long scenes so the "previous" slide is fully shown and nothing ends early.
    const pages = [];
    if (prev) pages.push({ ...prev, background: resolveBg(design, prev), duration: 1000, transition: 'none' });
    pages.push({ ...page, background: resolveBg(design, page), duration: 1000, transition: prev ? page.transition || 'none' : 'none' });
    const temp = { ...design, pages };
    const offset = prev ? 1000 : 0;
    const end = Math.max(prev && page.transition && page.transition !== 'none' ? 0.6 : 0,
      ...page.elements.filter(animated).map((e) => (Number(e.anim.delay) || 0) + (Number(e.anim.duration) || 0.7))) + 0.05;
    (async () => {
      const [{ drawFrame }, { ensureFonts, preloadImages }, { registerFonts }] = await Promise.all([import('@/lib/video'), import('@/lib/export'), import('@/lib/fonts')]);
      await registerFonts(design); await ensureFonts(design); await preloadImages(temp);
      if (stop) return;
      const t0 = performance.now();
      const tick = async () => {
        if (stop) return;
        const t = (performance.now() - t0) / 1000;
        await drawFrame(ctx, temp, offset + Math.min(t, end));
        if (t >= end) { done.current?.(); return; }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [design, from, to]);
  return <canvas ref={ref} style={{ display: 'block' }} />;
}

export default function Presenter({ design, start = 0, onClose, remoteId }) {
  const [remote, setRemote] = useState(false); // let people follow along at /d/[id]/live
  const [copied, setCopied] = useState(false);
  const liveUrl = remoteId && typeof location !== 'undefined' ? `${location.origin}/d/${remoteId}/live` : '';
  const [i, setI] = useState(start);
  const [ready, setReady] = useState(false); // false until they press OK on the "Esc exits" notice
  const [playing, setPlaying] = useState(null); // { from, to } while a slide's transition/animations play
  const shown = useRef(null);
  const ref = useRef(null);
  const okRef = useRef(null);
  const entered = useRef(false);
  const n = design.pages.length;
  const nRef = useRef(n);
  nRef.current = n;
  const readyRef = useRef(false);
  readyRef.current = ready;
  // Keep the latest onClose without re-running the setup below (parents pass a new function every render).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    okRef.current?.focus();
    const close = () => closeRef.current?.();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (!readyRef.current) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
        return;
      }
      const last = nRef.current - 1;
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(last, x + 1)); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
    };
    // Leaving fullscreen (the browser's own Esc) also ends the presentation.
    const onFs = () => {
      if (document.fullscreenElement) entered.current = true;
      else if (entered.current) close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Moving forward one slide plays its transition and animations; jumping or going back just shows it.
  // (A layout effect, so the finished slide never flashes up before its animation starts.)
  useLayoutEffect(() => {
    if (!ready) return;
    const prev = shown.current;
    shown.current = i;
    const page = design.pages[Math.min(i, n - 1)];
    if (!page) return;
    if (prev == null && needsPlay(page, false)) setPlaying({ from: null, to: i });
    else if (prev != null && i === prev + 1 && needsPlay(page, true)) setPlaying({ from: prev, to: i });
    else setPlaying(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, ready]);

  // Remote presenting: tell followers which slide is showing (and keep reminding them while presenting).
  useEffect(() => {
    if (!remote || !ready || !remoteId) return undefined;
    const say = (body) => fetch(`/api/designs/${remoteId}/present`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    say({ page: i });
    const t = setInterval(() => say({ page: i }), 10_000);
    return () => clearInterval(t);
  }, [remote, ready, remoteId, i]);
  useEffect(() => {
    if (!remote || !remoteId) return undefined;
    const end = () => fetch(`/api/designs/${remoteId}/present`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }), keepalive: true }).catch(() => {});
    window.addEventListener('pagehide', end);
    return () => { window.removeEventListener('pagehide', end); end(); };
  }, [remote, remoteId]);

  function begin() {
    setReady(true);
    // Called from a click/keypress, so the browser allows fullscreen. If it's refused, present in the window.
    ref.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="present" ref={ref} onClick={(e) => { if (e.target.closest?.('video, audio')) return; if (ready) setI((x) => (x + 1 < n ? x + 1 : x)); }}>
      {playing && ready
        ? <SlidePlayer key={`${playing.from}-${playing.to}`} design={design} from={playing.from} to={playing.to} onDone={() => setPlaying(null)} />
        : <DesignPage design={design} page={design.pages[Math.min(i, n - 1)]} width="100%" height="100%" uidPrefix="present-" media="autoplay" />}
      {ready ? (
        <div className="present-hint">{remote ? '📡 Live · ' : ''}{i + 1} / {n} · ← → to move</div>
      ) : (
        <div className="present-notice" onClick={(e) => e.stopPropagation()}>
          <div className="present-card">
            <div style={{ fontSize: 34 }}>⌨️</div>
            <b style={{ fontSize: 18 }}>Press Esc to exit</b>
            <span>Use ← → or click to change slides.</span>
            {remoteId ? (
              <div className="present-remote">
                <label className="row small" style={{ gap: 6, justifyContent: 'center' }}>
                  <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
                  📡 Present remotely: people with the link follow along
                </label>
                {remote ? (
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" readOnly value={liveUrl} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />
                    <button className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(liveUrl); setCopied(true); } catch {} }}>{copied ? 'Copied' : 'Copy'}</button>
                  </div>
                ) : null}
                {remote ? <span className="small">Viewers need access to the design (see Share).</span> : null}
              </div>
            ) : null}
            <button ref={okRef} className="btn btn-primary" onClick={begin}>{remote ? 'Start presenting' : 'OK'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
