'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DesignPage from './DesignPage';
import Presenter from './Presenter';
import ShareModal from './ShareModal';
import DocPaper from './DocPaper';
import VideoPlayer from './VideoPlayer';
import SheetView from './SheetView';
import { exportImage, exportPdf } from '@/lib/export';
import { exportDocWord, exportDocHtml, exportDocText } from '@/lib/docExport';
import { registerFonts } from '@/lib/fonts';

const ALL = { view: true, comment: true, download: true, print: true, remix: true, edit: true };

export default function DesignViewer({ id, title, design, role, perms = ALL, signedIn, likes: initialLikes, liked: initialLiked, visibility }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState('');
  const [, setFontsReady] = useState(0);
  const isDoc = design.kind === 'doc';
  const isVideo = design.kind === 'video';
  const isSheet = design.kind === 'sheet';
  const n = isDoc || isVideo || isSheet ? 1 : design.pages.length;
  const login = () => { location.href = `/api/auth/login?next=/d/${id}`; };

  useEffect(() => { registerFonts(design).then(() => setFontsReady((x) => x + 1)); }, [design]);

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
        await exportVideo(design, title, { scale: Math.min(1, 1280 / Math.max(design.width, design.height)), onProgress: (s, t) => setBusy(`Recording video… ${Math.round((s / t) * 100)}%`) });
      } else if (kind === 'doc') exportDocWord(design, title);
      else if (kind === 'html') exportDocHtml(design, title);
      else if (kind === 'txt') exportDocText(design, title);
      else if (kind === 'pdf') await exportPdf(design, title);
      else await exportImage(design, title, { format: kind === 'png-all' ? 'png' : kind, pageIndex: kind === 'png-all' ? null : i });
    } finally { setBusy(''); }
  }

  return (
    <div className="stack" style={{ gap: 14, minWidth: 0 }}>
      <div className="viewer-stage">
        {isSheet ? (
          <div style={{ width: '100%' }}><SheetView design={design} /></div>
        ) : isVideo ? (
          <div style={{ width: '100%' }}><VideoPlayer design={design} /></div>
        ) : isDoc ? (
          <div style={{ width: '100%', overflow: 'auto', maxHeight: '75vh', display: 'flex', justifyContent: 'center' }}>
            <DocPaper design={design} />
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: `calc(70vh * ${design.width / design.height})`, aspectRatio: `${design.width} / ${design.height}`, boxShadow: '0 8px 30px rgba(0,0,0,.18)' }}>
            <DesignPage design={design} page={design.pages[i]} width="100%" height="100%" uidPrefix="v-" style={{ display: 'block' }} media="controls" />
          </div>
        )}
        {n > 1 ? (
          <div className="row">
            <button className="btn btn-sm" disabled={i === 0} onClick={() => setI(i - 1)}>←</button>
            <span className="small">{i + 1} / {n}</span>
            <button className="btn btn-sm" disabled={i === n - 1} onClick={() => setI(i + 1)}>→</button>
          </div>
        ) : null}
      </div>
      <div className="row wrap">
        <button className={`btn ${liked ? 'active' : ''}`} onClick={like}>{liked ? '♥' : '♡'} {likes}</button>
        {perms.remix ? <button className="btn" onClick={remix}>🔁 {role === 'owner' ? 'Make a copy' : 'Remix'}</button> : null}
        <button className="btn" onClick={() => setModal('share')}>🔗 Share</button>
        {perms.download ? (
          <div style={{ position: 'relative' }}>
            <button className="btn" onClick={() => setModal(modal === 'dl' ? null : 'dl')}>⬇ Download</button>
            {modal === 'dl' ? (
              <div className="dropdown" style={{ left: 0, right: 'auto' }}>
                {isVideo ? <button onClick={() => download('video')}>🎬 Video <small>MP4</small></button> : null}
                {isSheet ? <button onClick={() => download('csv')}>📊 Spreadsheet <small>.csv</small></button> : null}
                {isSheet ? null : isDoc ? (
                  <>
                    <button onClick={() => download('doc')}>📝 Word <small>.doc</small></button>
                    <button onClick={() => download('html')}>🌐 Web page <small>.html</small></button>
                    <button onClick={() => download('txt')}>📃 Plain text <small>.txt</small></button>
                    <button onClick={() => { setModal(null); window.open(`/d/${id}/print`, '_blank'); }}>📄 PDF <small>via print</small></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => download('png')}>🖼 PNG <small>this page</small></button>
                    {n > 1 ? <button onClick={() => download('png-all')}>🗂 PNG <small>all pages</small></button> : null}
                    <button onClick={() => download('jpg')}>📷 JPG <small>this page</small></button>
                    <button onClick={() => download('pdf')}>📄 PDF <small>all pages</small></button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        {perms.print ? <a className="btn" href={`/d/${id}/print`} target="_blank" rel="noreferrer">🖨 Print</a> : null}
        {!isDoc && !isVideo ? <button className="btn" onClick={() => setModal('present')}>▶ Present</button> : null}
        {busy ? <span className="muted small">{busy}</span> : null}
      </div>
      {modal === 'share' ? <ShareModal id={id} title={title} role={role} visibility={visibility} onVisibility={async (v) => {
        await fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: v }) });
        router.refresh();
      }} onClose={() => setModal(null)} /> : null}
      {modal === 'present' ? <Presenter design={design} start={i} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
