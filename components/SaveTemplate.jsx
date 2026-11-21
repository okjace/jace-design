'use client';
import { useState } from 'react';

const CATEGORIES = ['Social media', 'Presentations', 'Print', 'Docs', 'Marketing', 'Video', 'Education', 'Business', 'Personal', 'Other'];

// Save a snapshot of a design as a reusable template (private, or shared with the community).
export default function SaveTemplate({ id, title, beforeSave, onClose }) {
  const [name, setName] = useState(title);
  const [category, setCategory] = useState('Other');
  const [visibility, setVisibility] = useState('private');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true); setErr('');
    try {
      await beforeSave?.();
      const r = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: id, title: name, category, visibility }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save');
      setDone(d.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>📌 Save as template</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {done ? (
            <>
              <div className="notice ok" style={{ margin: 0 }}>Saved! It&apos;s in Create → Templates{visibility === 'public' ? ', and everyone can use it from Community templates' : ''}.</div>
              <div className="row"><div className="grow" /><a className="btn" href={`/design/${done}`} target="_blank" rel="noreferrer">Edit the template</a><button className="btn btn-primary" onClick={onClose}>Done</button></div>
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>Saves a copy of this design as it is now. Using a template always makes a new copy, so the template itself never changes.</p>
              <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
              <label className="field">Category
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
              <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button className={visibility === 'private' ? 'active' : ''} onClick={() => setVisibility('private')}><b>Just me</b><span>Only you can use it</span></button>
                <button className={visibility === 'public' ? 'active' : ''} onClick={() => setVisibility('public')}><b>Community</b><span>Anyone on Jace Design can use it</span></button>
              </div>
              {err ? <div className="notice err" style={{ margin: 0 }}>{err}</div> : null}
              <div className="row"><div className="grow" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Save template'}</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
