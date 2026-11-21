import Link from 'next/link';
import { getUser } from '@/lib/auth';
import PhotoLibrary from '@/components/PhotoLibrary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jace Photos', description: 'Free community photos to use in your designs, shared by people on Jace Design.' };

// Jace Photos: the community library, and your own Photos tab (?tab=mine).
export default async function PhotosPage({ searchParams }) {
  const sp = await searchParams;
  const user = await getUser().catch(() => null);
  const mine = sp?.tab === 'mine' && !!user;
  return (
    <main className="page">
      <section className="hero" style={{ padding: '32px 36px' }}>
        <h1 style={{ fontSize: 34 }}>📷 Jace Photos</h1>
        <p>Photos shared by the Jace Design community, free to use in your designs. Upload yours and pick them right from the editor’s Photos panel.</p>
      </section>
      <div className="tabs" style={{ marginTop: 20 }}>
        <Link className={`tab ${!mine ? 'active' : ''}`} href="/photos">Community</Link>
        {user ? <Link className={`tab ${mine ? 'active' : ''}`} href="/photos?tab=mine">Your photos</Link> : null}
      </div>
      <div style={{ marginTop: 16 }}>
        {mine ? (
          <PhotoLibrary key="mine" scope="mine" manage signedIn />
        ) : (
          <>
            {!user ? <div className="notice"><a href="/api/auth/login?next=/photos?tab=mine" style={{ textDecoration: 'underline' }}>Sign in with Jace</a> to upload your own photos.</div> : null}
            <PhotoLibrary key="community" scope="community" signedIn={!!user} />
          </>
        )}
      </div>
    </main>
  );
}
