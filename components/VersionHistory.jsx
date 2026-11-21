'use client';
import { useEffect, useState } from 'react';
import DesignPage from './DesignPage';

const when = (d) => {
  const t = new Date(d);
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return t.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Version history: see earlier versions of a design, save one by name, or restore one. */
export default function VersionHistory({ id, beforeSave, onClose }) {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null); // { id, data, title }
  const [pageI, setPageI] = useState(0);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = () => fetch(`/api/designs/${id}/versions`).then((r) => r.json()).then((d) => setList(d.versions || [])).catch(() => setList([]));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function open(v) {
    setErr(''); setPageI(0);
    setSel({ id: v.id, loading: true });
    const r = await fetch(`/api/designs/${id}/versions/${v.id}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || 'Could not open that version.'); setSel(null); return; }
    setSel(d.version);
  }

  async function saveNamed(e) {
    e.preventDefault();
    setBusy('save'); setErr('');
    try {
      await beforeSave?.();
      const r = await fetch(`/api/designs/${id}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save the version.');
      setName('');
      await load();
    } catch (x) { setErr(x.message); } finally { setBusy(''); }
  }

  async function restore() {
    if (!sel?.id) return;
    setBusy('restore'); setErr('');
    try {
      await beforeSave?.();
      const r = await fetch(`/api/designs/${id}/versions/${sel.id}`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not restore that version.');
      location.reload();
    } catch (x) { setErr(x.message); setBusy(''); }
  }

  async function remove(v) {
    await fetch(`/api/designs/${id}/versions/${v.id}`, { method: 'DELETE' });
    if (sel?.id === v.id) setSel(null);
    load();
  }

  const d = sel?.data;
  const kind = d?.kind;
  const pages = d?.pages || [];

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(920px, 100%)' }}>
        <div className="modal-head"><h3>🕘 Version history</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body versions">
          <div className="versions-list">
            <form className="row" style={{ gap: 6 }} onSubmit={saveNamed}>
              <input className="input" placeholder="Name this version (optional)" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 13 }} />
              <button className="btn btn-sm btn-primary" disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            </form>
            <p className="small muted" style={{ margin: '6px 0' }}>A version is kept automatically before each editing session. Named versions are kept until you delete them.</p>
            {!list ? <p className="small muted">Loading…</p> : !list.length ? <p className="small muted">No versions yet. They appear after the next edits, or save one now.</p> : list.map((v) => (
              <div key={v.id} className={`layer ${sel?.id === v.id ? 'active' : ''}`} onClick={() => open(v)}>
                <span className="name">
                  <b>{v.name || when(v.created_at)}</b>
                  <span className="small muted" style={{ display: 'block' }}>{v.name ? `${when(v.created_at)} · ` : ''}{v.user_name || v.username || ''}</span>
                </span>
                <button title="Delete this version" onClick={(e) => { e.stopPropagation(); remove(v); }}>🗑</button>
              </div>
            ))}
          </div>
          <div className="versions-preview">
            {!sel ? <p className="muted">Pick a version to see it.</p> : sel.loading ? <p className="muted">Loading…</p> : (
              <>
                <div className="row"><b className="grow">{sel.title}</b>{sel.name ? <span className="small muted">{sel.name}</span> : null}</div>
                <div className="versions-frame">
                  {kind === 'doc' ? (
                    <div className="versions-doc" dangerouslySetInnerHTML={{ __html: d.html || '' }} />
                  ) : kind === 'sheet' ? (
                    <p className="muted">Spreadsheet with {(d.sheets || []).length} sheet{(d.sheets || []).length === 1 ? '' : 's'}: {(d.sheets || []).map((s) => s.name).join(', ')}</p>
                  ) : pages.length ? (
                    <DesignPage design={d} page={pages[Math.min(pageI, pages.length - 1)]} width="100%" uidPrefix={`ver-${sel.id}-`} style={{ maxHeight: '52vh', display: 'block' }} />
                  ) : null}
                </div>
                {pages.length > 1 && kind !== 'doc' && kind !== 'sheet' ? (
                  <div className="row" style={{ justifyContent: 'center' }}>
                    <button className="btn btn-sm" disabled={pageI === 0} onClick={() => setPageI(pageI - 1)}>◀</button>
                    <span className="small">{pageI + 1} / {pages.length}</span>
                    <button className="btn btn-sm" disabled={pageI >= pages.length - 1} onClick={() => setPageI(pageI + 1)}>▶</button>
                  </div>
                ) : null}
                <div className="row">
                  <span className="small muted grow">Restoring keeps what's there now as a version too, so you can switch back.</span>
                  <button className="btn btn-primary" disabled={busy === 'restore'} onClick={restore}>{busy === 'restore' ? 'Restoring…' : 'Restore this version'}</button>
                </div>
              </>
            )}
            {err ? <p className="small" style={{ color: 'var(--danger)' }}>{err}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
