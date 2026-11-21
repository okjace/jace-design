'use client';
import { useEffect, useRef, useState } from 'react';
import { SAVE_LABELS, clearBackup, createSaver, readBackup } from '@/lib/saver';

/**
 * Reliable autosave for an editor. Call `changed()` after every edit.
 * Returns { state, label, changed, now, retry, hasUnsaved, notices } — render `notices` somewhere in the editor.
 */
export function useSaver({ id, version, getBody, onLocked, onSaved, onRestore }) {
  const [state, setState] = useState('saved');
  const [conflict, setConflict] = useState(null);
  const [backup, setBackup] = useState(null);
  const [notice, setNotice] = useState('');
  const ref = useRef(null);
  const cbs = useRef({});
  cbs.current = { getBody, onLocked, onSaved, onRestore };

  useEffect(() => {
    const s = createSaver({
      id,
      version,
      getBody: () => cbs.current.getBody(),
      onState: setState,
      onLocked: () => cbs.current.onLocked?.(),
      onConflict: (info) => setConflict(info || {}),
      onNotice: (text) => { setNotice(text); clearTimeout(ref.noticeTimer); ref.noticeTimer = setTimeout(() => setNotice(''), 6000); },
      onSaved: () => { setConflict(null); cbs.current.onSaved?.(); },
    });
    ref.current = s;
    // Unsaved work from last time (the tab closed or crashed before it reached the server)?
    readBackup(id).then((b) => { if (b?.body) setBackup(b); }).catch(() => {});
    const warn = (e) => { if (s.hasUnsaved() && s.state() !== 'locked') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); s.stop(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const api = {
    state,
    label: SAVE_LABELS[state] || state,
    changed: () => ref.current?.changed(),
    now: () => ref.current?.now(),
    retry: () => ref.current?.retry(),
    stop: () => ref.current?.stop(),
    hasUnsaved: () => !!ref.current?.hasUnsaved(),
    version: () => ref.current?.version() || null,
    setVersion: (v) => ref.current?.setVersion(v),
  };

  api.notices = (
    <>
      {backup ? (
        <div className="save-notice">
          <span>💾 We found changes from <b>{new Date(backup.at).toLocaleString()}</b> that weren’t saved.</span>
          <button className="btn btn-sm btn-primary" onClick={() => { cbs.current.onRestore?.(backup.body); setBackup(null); setTimeout(() => ref.current?.changed(), 0); }}>Restore them</button>
          <button className="btn btn-sm" onClick={() => { clearBackup(id); setBackup(null); }}>Discard</button>
        </div>
      ) : null}
      {notice ? <div className="save-notice" role="status"><span>ℹ️ {notice}</span><button className="btn btn-sm" onClick={() => setNotice('')}>OK</button></div> : null}
      {conflict ? (
        <div className="modal-back" style={{ zIndex: 950 }}>
          <div className="modal" style={{ width: 'min(460px, 100%)' }}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center', padding: 26 }}>
              <div style={{ fontSize: 40 }}>🔀</div>
              <h3 style={{ margin: 0 }}>Someone else saved this design</h3>
              <p className="muted" style={{ margin: 0 }}>
                It was changed in another tab or by someone you shared it with while you were editing.
                Load their version, or keep yours (theirs will be replaced).
              </p>
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => location.reload()}>Load their version</button>
                <button className="btn btn-primary" onClick={() => { setConflict(null); ref.current?.keepMine?.(); }}>Keep mine</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
  return api;
}
