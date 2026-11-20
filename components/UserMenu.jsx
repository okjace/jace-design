'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="usermenu" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen(!open)} aria-label="Account menu">
        <Avatar user={user} size={34} />
      </button>
      {open ? (
        <div className="menu" onClick={() => setOpen(false)}>
          <div className="menu-head">
            <b>{user.name}</b>
            <span className="muted">@{user.username}</span>
          </div>
          <Link href={`/u/${encodeURIComponent(user.username)}`}>Your profile</Link>
          <Link href="/">Your designs</Link>
          <Link href="/settings">Settings</Link>
          <form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form>
        </div>
      ) : null}
    </div>
  );
}
