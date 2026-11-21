'use client';
// Reliable saving for every editor (designs, documents, spreadsheets):
//  • waits a moment after you stop editing, then saves; never two saves at once
//  • retries automatically (1s, 2s, 4s… up to 30s) when the network or server has a hiccup
//  • notices when you're offline and saves as soon as you're back
//  • keeps a backup of unsaved work in this browser (IndexedDB) so nothing is lost if the tab closes or crashes
//  • tries one last save when you switch away from the tab or close it
//  • checks the design's version so two people (or two tabs) don't silently overwrite each other

const DB = 'jace-design';
const STORE = 'unsaved';

function idb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDo(mode, fn) {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return undefined; // private mode / storage blocked: saving still works, just without the backup
  }
}
export const readBackup = (id) => idbDo('readonly', (s) => s.get(id));
const writeBackup = (id, value) => idbDo('readwrite', (s) => s.put(value, id));
export const clearBackup = (id) => idbDo('readwrite', (s) => s.delete(id));

export const SAVE_LABELS = {
  saved: '✓ Saved',
  unsaved: 'Unsaved',
  saving: 'Saving…',
  retrying: 'Couldn’t save, trying again…',
  offline: 'Offline — will save when you’re back',
  toobig: '⚠ Too big to save (use smaller images)',
  error: '⚠ Save failed — click to retry',
  locked: 'No access',
};

/**
 * @param {object} o
 * @param {string} o.id               design id
 * @param {() => object} o.getBody    what to send: { design, title }
 * @param {string} [o.version]        the design's updated_at when it was opened
 * @param {(state:string)=>void} o.onState
 * @param {()=>void} [o.onLocked]     access was removed while editing
 * @param {(theirs, theirTitle)=>Promise|void} [o.merge] someone else saved first: fold their design into ours
 * @param {(sent)=>void} [o.onSent]  a save reached the server
 * @param {()=>void} [o.onSaved]
 */
export function createSaver(o) {
  let version = o.version || null;
  let timer = null, retryTimer = null, backupTimer = null;
  let inFlight = null;
  let dirty = false;           // changes not yet sent
  let attempts = 0;
  let stopped = false;
  let state = 'saved';
  let force = false;           // next save overwrites even if the version changed ("Keep mine")
  const client = Math.random().toString(36).slice(2, 12); // this open editor
  let selfFixes = 0;           // quiet retries after a conflict with ourselves
  const set = (s) => { if (s !== state) { state = s; o.onState?.(s); } };

  async function send({ keepalive = false } = {}) {
    if (stopped) return;
    if (inFlight) { dirty = true; return inFlight; }
    if (!dirty && state === 'saved') return;
    clearTimeout(timer); clearTimeout(retryTimer);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { set('offline'); return; }
    dirty = false;
    const payload = { ...o.getBody(), client, ...(version && !force ? { expected: version } : {}) };
    const body = JSON.stringify(payload);
    if (body.length > 4_300_000) { set('toobig'); return; }
    set('saving');
    inFlight = (async () => {
      try {
        const r = await fetch(`/api/designs/${o.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
          keepalive: keepalive && body.length < 60_000,
        });
        if (r.status === 401 || r.status === 403 || r.status === 404) { stopped = true; set('locked'); o.onLocked?.(); return; }
        if (r.status === 409) {
          const info = await r.json().catch(() => ({}));
          dirty = true;
          set('unsaved');
          if (selfFixes++ > 6) { force = true; return; } // something keeps changing it: just save ours
          // Someone (or another of your windows) saved first. Never ask: combine their changes with ours, then save.
          if (o.merge && !info.same_client) {
            try {
              const g = await fetch(`/api/designs/${o.id}`, { cache: 'no-store' });
              const j = await g.json();
              if (g.ok && j.design) {
                await o.merge(j.design.data, j.design.title);
                version = j.version || info.updated_at || version;
                return;
              }
            } catch {}
          }
          if (info.updated_at) version = info.updated_at; else force = true;
          return;
        }
        if (r.status === 413) { set('toobig'); return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json().catch(() => ({}));
        if (data.updated_at) version = data.updated_at;
        force = false;
        attempts = 0;
        selfFixes = 0;
        o.onSent?.(payload); // what the server now has (the starting point for merging others' changes)
        if (!dirty) { set('saved'); clearBackup(o.id); o.onSaved?.(); }
      } catch {
        // Network trouble or a server hiccup: keep the changes and try again with a growing wait.
        dirty = true;
        attempts++;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { set('offline'); return; }
        set(attempts > 6 ? 'error' : 'retrying');
        retryTimer = setTimeout(() => send(), Math.min(30_000, 1000 * 2 ** Math.min(attempts - 1, 5)));
      } finally {
        inFlight = null;
      }
      if (dirty && state !== 'retrying' && state !== 'offline' && !stopped) schedule(300);
    })();
    return inFlight;
  }

  function schedule(delay = 900) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => send(), delay);
  }

  /** Call after every change. */
  function changed() {
    if (stopped) return;
    dirty = true;
    if (state === 'saved' || state === 'error') set('unsaved');
    // Back up to this browser right away (cheap), save to the server after a short pause.
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => {
      try { writeBackup(o.id, { at: Date.now(), version, body: o.getBody() }); } catch {}
    }, 400);
    schedule();
  }

  const onOnline = () => { if (dirty) { attempts = 0; send(); } };
  const onOffline = () => { if (dirty || state === 'saving') set('offline'); };
  const onHide = () => { if (document.visibilityState === 'hidden' && dirty) send({ keepalive: true }); };
  const onPageHide = () => { if (dirty) send({ keepalive: true }); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return {
    changed,
    /** Save right away (e.g. before printing or Ctrl+S). Resolves when done. */
    async now() { dirty = dirty || state !== 'saved'; await send(); if (inFlight) await inFlight; },
    retry() { attempts = 0; dirty = true; send(); },
    hasUnsaved: () => dirty || ['unsaved', 'saving', 'retrying', 'offline', 'error'].includes(state),
    state: () => state,
    /** The version (updated_at) this editor's content is based on. */
    version: () => version,
    /** After loading someone else's saved changes, base the next save on their version. */
    setVersion(v) { if (v) version = v; },
    stop() {
      stopped = true;
      clearTimeout(timer); clearTimeout(retryTimer); clearTimeout(backupTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}
