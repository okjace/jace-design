'use client';
import { useEffect, useRef, useState } from 'react';
import { SAVE_LABELS, clearBackup, createSaver, readBackup } from '@/lib/saver';

/**
 * Reliable autosave for an editor. Call `changed()` after every edit.
 * Nothing ever pops up: if someone else saved first, `merge(theirs, theirTitle)` folds their work in
 * (or, without merge, this editor's version is saved), and unsaved work from a closed tab comes back by itself.
 * Returns { state, label, changed, now, retry, hasUnsaved, version, setVersion, notices }.
 */
export function useSaver({ id, version, getBody, onLocked, onSaved, onRestore, merge, onSent }) {
  const [state, setState] = useState('saved');
  const ref = useRef(null);
  const cbs = useRef({});
  cbs.current = { getBody, onLocked, onSaved, onRestore, merge, onSent };

  useEffect(() => {
    const s = createSaver({
      id,
      version,
      getBody: () => cbs.current.getBody(),
      onState: setState,
      onLocked: () => cbs.current.onLocked?.(),
      onSaved: () => cbs.current.onSaved?.(),
      onSent: (sent) => cbs.current.onSent?.(sent),
      merge: cbs.current.merge ? (theirs, title) => cbs.current.merge(theirs, title) : null,
    });
    ref.current = s;
    // Unsaved work from last time (the tab closed or crashed before it reached the server):
    // if nothing was saved since, put it back and save it; otherwise the saved version is newer, so drop it.
    readBackup(id).then((b) => {
      if (!b?.body) return;
      if (b.version && version && b.version === version && cbs.current.onRestore) {
        cbs.current.onRestore(b.body);
        setTimeout(() => ref.current?.changed(), 0);
      } else {
        clearBackup(id);
      }
    }).catch(() => {});
    const warn = (e) => { if (s.hasUnsaved() && s.state() !== 'locked') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); s.stop(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    label: SAVE_LABELS[state] || state,
    changed: () => ref.current?.changed(),
    now: () => ref.current?.now(),
    retry: () => ref.current?.retry(),
    stop: () => ref.current?.stop(),
    hasUnsaved: () => !!ref.current?.hasUnsaved(),
    version: () => ref.current?.version() || null,
    setVersion: (v) => ref.current?.setVersion(v),
    notices: null,
  };
}
