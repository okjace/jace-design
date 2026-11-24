'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DesignCard from './DesignCard';

/**
 * Your designs on the home page, with "select many": tick designs (or Select all), then star, move to a folder,
 * export or delete them together.
 */
export default function DesignGrid({ designs, folders = [] }) {
  const router = useRouter();
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const on = sel.size > 0;

  // Designs that disappeared (deleted elsewhere) leave the selection.
  useEffect(() => {
    setSel((s) => { const ids = new Set(designs.map((d) => d.id)); const n = new Set([...s].filter((x) => ids.has(x))); return n.size === s.size ? s : n; });
  }, [designs]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel];

  async function each(fn, label) {
    setBusy(label);
    try {
      for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(fn));
    } finally {
      setBusy('');
      router.refresh();
    }
  }
  const star = (onOff) => each((id) => fetch(`/api/designs/${id}/star`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: onOff }) }), onOff ? 'Starring…' : 'Unstarring…');
  const move = (folderId) => { setMoveOpen(false); return each((id) => fetch(`/api/designs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId || null }) }), 'Moving…'); };
  const remove = async () => {
    if (!confirm(`Delete ${ids.length} design${ids.length === 1 ? '' : 's'}? This can't be undone.`)) return;
    await each((id) => fetch(`/api/designs/${id}`, { method: 'DELETE' }), 'Deleting…');
    setSel(new Set());
  };
  async function exportSel(list = ids) {
    setBusy('Exporting…');
    try {
      const { exportDesigns } = await import('@/lib/exportDesigns');
      await exportDesigns(list, { onProgress: (d, t) => setBusy(`Exporting ${Math.min(d + 1, t)} of ${t}…`) });
    } catch (e) {
      alert(e.message || 'Export failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className={`select-bar ${on ? 'on' : ''}`}>
        {on ? (
          <>
            <b>{sel.size} selected</b>
            <button className="btn btn-sm" onClick={() => setSel(new Set(designs.map((d) => d.id)))}>Select all ({designs.length})</button>
            <div className="grow" />
            <button className="btn btn-sm" disabled={!!busy} onClick={() => star(true)}>⭐ Star</button>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => star(false)}>☆ Unstar</button>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => setMoveOpen(!moveOpen)}>📁 Move to…</button>
              {moveOpen ? (
                <div className="dropdown">
                  <button onClick={() => move(null)}>No folder</button>
                  {folders.map((f) => <button key={f.id} onClick={() => move(f.id)}>📁 {f.name}</button>)}
                  {!folders.length ? <span className="small muted" style={{ padding: 8 }}>Make a folder first</span> : null}
                </div>
              ) : null}
            </div>
            <button className="btn btn-sm" disabled={!!busy} onClick={() => exportSel()}>⬇ Export</button>
            <button className="btn btn-sm btn-danger" disabled={!!busy} onClick={remove}>🗑 Delete</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSel(new Set())}>Cancel</button>
          </>
        ) : (
          <>
            <span className="small muted">Tick ☐ on designs to select several.</span>
            <div className="grow" />
            {designs.length ? <button className="btn btn-sm" onClick={() => setSel(new Set(designs.map((d) => d.id)))}>☑ Select all</button> : null}
            {designs.length ? <button className="btn btn-sm" disabled={!!busy} onClick={() => exportSel(designs.map((d) => d.id))}>⬇ Export all</button> : null}
          </>
        )}
        {busy ? <span className="small muted">{busy}</span> : null}
      </div>
      <div className="grid">
        {designs.map((d) => (
          <DesignCard key={d.id} d={d} mine folders={folders} selected={sel.has(d.id)} selecting={on} onSelect={() => toggle(d.id)} />
        ))}
      </div>
    </>
  );
}
