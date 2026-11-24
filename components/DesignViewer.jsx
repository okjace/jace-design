'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DesignPage from './DesignPage';
import Presenter from './Presenter';
import ShareModal from './ShareModal';
import DocPaper from './DocPaper';
import VideoPlayer from './VideoPlayer';
import SheetView from './SheetView';
import Avatar from './Avatar';
import { exportImage, exportPdf } from '@/lib/export';
import { exportDocWord, exportDocHtml, exportDocText } from '@/lib/docExport';
import { registerFonts } from '@/lib/fonts';

const ALL = { view: true, comment: true, download: true, print: true, remix: true, edit: true };

/**
 * The view page, laid out like the editor: a top bar with the actions, the design in the middle (zoom, fit,
 * arrows), page thumbnails along the bottom, and the details and comments in a side panel.
 */
export default function DesignViewer({
  id, title, design, role, perms = ALL, signedIn, likes: initialLikes, liked: initialLiked, visibility,
  owner, canEdit, editHref, side, commentCount = 0,
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState('');
  const [, setFontsReady] = useState(0);
  const [panel, setPanel] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const scrollRef = useRef(null);
  const isDoc = design.kind === 'doc';
  const isVideo = design.kind === 'video';
  const isSheet = design.kind === 'sheet';
  const isCanvas = !isDoc && !isVideo && !isSheet;
  const n = isCanvas ? design.pages.length : 1;
  const W = design.width, H = design.height;
  const login = () => { location.href = `/api/auth/login?next=/d/${id}`; };

  useEffect(() => { registerFonts(design).then(() => setFontsReady((x) => x + 1)); }, [design]);
  useEffect(() => { if (window.innerWidth < 900) setPanel(false); }, []);

  // Is someone presenting this design live right now? (Lights up the Live button.)
  const [liveNow, setLiveNow] = useState(false);
  useEffect(() => {
    if (!isCanvas || typeof EventSource === 'undefined') return undefined;
    const es = new EventSource(`/api/designs/${id}/present`);
    es.addEventListener('slide', (e) => { try { setLiveNow(!!JSON.parse(e.data).live); } catch {} });
    return () => es.close();
  }, [id, isCanvas]);

  // Fit the page in the window (like the editor), unless you zoomed yourself.
  const fitNow = useCallback(() => {
    const s = scrollRef.current;
    if (!s || !isCanvas) return;
    setZoom(Math.max(0.05, Math.min(4, Math.min((s.clientWidth - 64) / W, (s.clientHeight - 64) / H))));
  }, [W, H, isCanvas]);
  useEffect(() => {
    if (!fit) return undefined;
    fitNow();
    const ro = new ResizeObserver(fitNow);
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [fit, fitNow, panel]);

  // Arrow keys change pages.
  useEffect(() => {
    const onKey = (e) => {
      if (modal || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setI((x) => Math.min(n - 1, x + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, modal]);

  async function like() {
    if (!signedIn) return login();
    const r = await fetch(`/api/designs/${id}/like`, { method: 'POST' });
    if (r.ok) { const d = await r.json(); setLikes(d.likes); setLiked(d.liked); }
  }
  async function remix() {
    if (!signedIn) return login();
    setBusy('Making your copy…');
    const r = await fetch(`/api/designs/${id}/remix`, { method: 'POST' });
    if (r.ok) { const d = await r.json(); router.push(`/design/${d.id}`); } else setBusy('');
  }
  async function download(kind) {
    setModal(null);
    setBusy('Preparing…');
    try {
      if (kind === 'csv') {
        const { makeEvaluator, toCSV } = await import('@/lib/sheet');
        const s = design.sheets[0];
        const { downloadBlob, safeName } = await import('@/lib/export');
        downloadBlob(new Blob([toCSV(s, makeEvaluator(s))], { type: 'text/csv' }), `${safeName(title)}.csv`);
      } else if (kind === 'video') {
        const { exportVideo } = await import('@/lib/video');
        await exportVideo(design, title, { scale: Math.min(1, 1280 / Math.max(W, H)), onProgress: (s, t) => setBusy(`Recording video… ${Math.round((s / t) * 100)}%`) });
      } else if (kind === 'doc') exportDocWord(design, title);
      else if (kind === 'html') exportDocHtml(design, title);
      else if (kind === 'txt') exportDocText(design, title);
      else if (kind === 'pdf') await exportPdf(design, title);
      else await exportImage(design, title, { format: kind === 'png-all' ? 'png' : kind, pageIndex: kind === 'png-all' ? null : i });
    } finally { setBusy(''); }
  }

  return (
    <div className={`vw ${panel ? '' : 'no-side'}`}>
      {/* ---------- top bar (like the editor's) ---------- */}
      <div className="ed-top vw-top">
        <Link href="/" className="btn btn-sm" title="Home">🏠</Link>
        <div className="vw-title">
          <b>{title}</b>
          {owner ? (
            <Link href={`/u/${encodeURIComponent(owner.username)}`} className="vw-owner">
              <Avatar user={owner} size={20} /> <span>{owner.name || owner.username}</span>
            </Link>
          ) : null}
        </div>
        {busy ? <span className="ed-status">{busy}</span> : null}
        <div className="grow" />
        <button className={`btn btn-sm ${liked ? 'active' : ''}`} onClick={like} title={liked ? 'Unlike' : 'Like'}>{liked ? '♥' : '♡'} {likes}</button>
        {perms.remix ? <button className="btn btn-sm" onClick={remix}>🔁 {role === 'owner' ? 'Copy' : 'Remix'}</button> : null}
        {isCanvas ? <button className="btn btn-sm" onClick={() => setModal('present')}>▶ Present</button> : null}
        {isCanvas ? (
          <a className={`btn btn-sm ${liveNow ? 'live-on' : ''}`} href={`/d/${id}/live`} title={liveNow ? 'Someone is presenting this live: watch along' : 'Watch along when someone presents this live'}>
            {liveNow ? '🔴 Live now' : '📡 Live'}
          </a>
        ) : null}
        {perms.print ? <a className="btn btn-sm" href={`/d/${id}/print`} target="_blank" rel="noreferrer">🖨 Print</a> : null}
        {perms.download ? (
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm" onClick={() => setModal(modal === 'dl' ? null : 'dl')}>⬇ Download</button>
            {modal === 'dl' ? (
              <div className="dropdown">
                {isVideo ? <button onClick={() => download('video')}>🎬 Video <small>MP4</small></button> : null}
                {isSheet ? <button onClick={() => download('csv')}>📊 Spreadsheet <small>.csv</small></button> : null}
                {isDoc ? (
                  <>
                    <button onClick={() => download('doc')}>📝 Word <small>.doc</small></button>
                    <button onClick={() => download('html')}>🌐 Web page <small>.html</small></button>
                    <button onClick={() => download('txt')}>📃 Plain text <small>.txt</small></button>
                    <button onClick={() => { setModal(null); window.open(`/d/${id}/print`, '_blank'); }}>📄 PDF <small>via print</small></button>
                  </>
                ) : null}
                {isCanvas ? (
                  <>
                    <button onClick={() => download('png')}>🖼 PNG <small>this page</small></button>
                    {n > 1 ? <button onClick={() => download('png-all')}>🗂 PNG <small>all pages</small></button> : null}
                    <button onClick={() => download('jpg')}>📷 JPG <small>this page</small></button>
                    <button onClick={() => download('pdf')}>📄 PDF <small>all pages</small></button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <button className="btn btn-sm" onClick={() => setModal('share')}>🔗 Share</button>
        <button className={`btn btn-sm ${panel ? 'active' : ''}`} onClick={() => setPanel(!panel)} title="Details and comments">💬{commentCount ? ` ${commentCount}` : ''}</button>
        {canEdit ? <a className="btn btn-sm btn-white" href={editHref}>✏️ Edit</a> : null}
      </div>

      <div className="vw-main">
        {/* ---------- the design ---------- */}
        <div className="ed-center">
          {isCanvas ? (
            <>
              <div className="ed-scroll vw-scroll" ref={scrollRef}
                onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setFit(false); setZoom((z) => Math.max(0.05, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1)))); } }}>
                <div className="ed-canvas-wrap" style={{ width: W * zoom, height: H * zoom }}>
                  <DesignPage design={design} page={design.pages[i]} width={W * zoom} height={H * zoom} uidPrefix="v-" media="controls" />
                </div>
              </div>
              {n > 1 ? (
                <>
                  <button className="vw-arrow left" disabled={i === 0} onClick={() => setI(i - 1)} title="Previous page (←)">‹</button>
                  <button className="vw-arrow right" disabled={i === n - 1} onClick={() => setI(i + 1)} title="Next page (→)">›</button>
                </>
              ) : null}
              <div className="ed-zoom" style={{ bottom: n > 1 ? 126 : 14 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setFit(false); setZoom((z) => Math.max(0.05, z / 1.25)); }}>−</button>
                <input type="range" min={5} max={400} value={Math.round(zoom * 100)} onChange={(e) => { setFit(false); setZoom(Number(e.target.value) / 100); }} />
                <button className="btn btn-ghost btn-sm" onClick={() => { setFit(false); setZoom((z) => Math.min(4, z * 1.25)); }}>+</button>
                <span style={{ width: 40 }}>{Math.round(zoom * 100)}%</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setFit(true); fitNow(); }}>Fit</button>
              </div>
              {n > 1 ? (
                <div className="ed-pages">
                  {design.pages.map((p, k) => (
                    <div key={p.id} className={`ed-page-thumb ${k === i ? 'active' : ''}`} onClick={() => setI(k)}>
                      <DesignPage design={design} page={p} width={Math.round((72 * W) / H)} height={72} uidPrefix={`vp${k}-`} />
                      <span className="n">{k + 1}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="ed-scroll vw-scroll vw-other">
              {isSheet ? <div style={{ width: '100%' }}><SheetView design={design} /></div>
                : isVideo ? <div className="vw-video"><VideoPlayer design={design} maxHeight="calc(100vh - 160px)" /></div>
                  : <div className="vw-doc"><DocPaper design={design} /></div>}
            </div>
          )}
        </div>

        {/* ---------- details and comments ---------- */}
        {panel ? <aside className="ed-side vw-side">{side}</aside> : null}
      </div>

      {modal === 'share' ? <ShareModal id={id} title={title} role={role} visibility={visibility} onVisibility={async (v) => {
        await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) });
        router.refresh();
      }} onClose={() => setModal(null)} /> : null}
      {modal === 'present' ? <Presenter design={design} start={i} remoteId={canEdit && signedIn ? id : undefined} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
