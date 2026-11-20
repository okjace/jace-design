'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DesignPage from './DesignPage';
import Presenter from './Presenter';
import ShareModal from './ShareModal';
import { exportImage, exportPdf } from '@/lib/export';

export default function DesignViewer({ id, title, design, role, signedIn, likes: initialLikes, liked: initialLiked, visibility }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState('');
  const n = design.pages.length;
  const login = () => { location.href = `/api/auth/login?next=/d/${id}`; };

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
      if (kind === 'pdf') await exportPdf(design, title);
      else await exportImage(design, title, { format: kind, pageIndex: kind === 'png-all' ? null : i });
    } finally { setBusy(''); }
  }

  return (
    <div className="stack" style={{ gap: 14, minWidth: 0 }}>
      <div className="viewer-stage">
        <div style={{ width: '100%', maxWidth: `calc(70vh * ${design.width / design.height})`, aspectRatio: `${design.width} / ${design.height}`, boxShadow: '0 8px 30px rgba(0,0,0,.18)' }}>
          <DesignPage design={design} page={design.pages[i]} width="100%" height="100%" uidPrefix="v-" style={{ display: 'block' }} />
        </div>
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
        <button className="btn" onClick={remix}>🔁 {role === 'owner' ? 'Make a copy' : 'Remix'}</button>
        <button className="btn" onClick={() => setModal('share')}>🔗 Share</button>
        <div style={{ position: 'relative' }}>
          <button className="btn" onClick={() => setModal(modal === 'dl' ? null : 'dl')}>⬇ Download</button>
          {modal === 'dl' ? (
            <div className="dropdown" style={{ left: 0, right: 'auto' }}>
              <button onClick={() => download('png')}>🖼 PNG <small>this page</small></button>
              {n > 1 ? <button onClick={() => download('png-all')}>🗂 PNG <small>all pages</small></button> : null}
              <button onClick={() => download('jpg')}>📷 JPG <small>this page</small></button>
              <button onClick={() => download('pdf')}>📄 PDF <small>all pages</small></button>
            </div>
          ) : null}
        </div>
        <a className="btn" href={`/d/${id}/print`} target="_blank" rel="noreferrer">🖨 Print</a>
        <button className="btn" onClick={() => setModal('present')}>▶ Present</button>
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
