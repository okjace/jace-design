'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Folder chips on the home page: All, Starred, your folders, and making/renaming/deleting folders. */
export default function FolderBar({ folders = [], active = '' }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const current = folders.find((f) => f.id === active);

  async function create() {
    const name = prompt('New folder name');
    if (!name?.trim()) return;
    const r = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || 'Could not make the folder.'); return; }
    router.push(`/?folder=${d.id}`);
    router.refresh();
  }
  async function rename() {
    const name = prompt('Rename folder', current.name);
    if (!name?.trim()) return;
    await fetch(`/api/folders/${current.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    router.refresh();
  }
  async function remove() {
    if (!confirm(`Delete the folder “${current.name}”? The designs in it are kept.`)) return;
    await fetch(`/api/folders/${current.id}`, { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="folder-bar">
      <Link href="/" className={`chip ${!active ? 'active' : ''}`}>All designs</Link>
      <Link href="/?folder=starred" className={`chip ${active === 'starred' ? 'active' : ''}`}>⭐ Starred</Link>
      {folders.map((f) => (
        <Link key={f.id} href={`/?folder=${f.id}`} className={`chip ${active === f.id ? 'active' : ''}`}>📁 {f.name} <small>{f.count}</small></Link>
      ))}
      <button className="chip" onClick={create}>＋ New folder</button>
      {current ? (
        <>
          <span className="grow" />
          <button className="btn btn-sm" onClick={rename}>✏️ Rename</button>
          <button className="btn btn-sm btn-danger" onClick={remove}>🗑 Delete folder</button>
        </>
      ) : null}
      {err ? <span className="small" style={{ color: 'var(--danger)' }}>{err}</span> : null}
    </div>
  );
}
