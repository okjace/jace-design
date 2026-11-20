'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FollowButton({ username, initial, signedIn }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!signedIn) { location.href = `/api/auth/login?next=/u/${encodeURIComponent(username)}`; return; }
    setBusy(true);
    const r = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' });
    setBusy(false);
    if (r.ok) { setFollowing((await r.json()).following); router.refresh(); }
  }
  return <button className={`btn ${following ? '' : 'btn-primary'}`} disabled={busy} onClick={toggle}>{following ? 'Following ✓' : '+ Follow'}</button>;
}
