import { getUser } from '@/lib/auth';
import AppDirectory from '@/components/AppDirectory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Apps', description: 'Apps you can use inside Jace Design: QR codes, ChatGPT, calendars, palettes and apps made by the community.' };

export default async function AppsPage() {
  const user = await getUser().catch(() => null);
  return (
    <main className="page">
      <section className="hero" style={{ padding: '32px 36px' }}>
        <h1 style={{ fontSize: 34 }}>🧰 Apps</h1>
        <p>Little tools that add things to your designs: QR codes, ChatGPT, calendars, palettes and more. Add apps made by the community, or make your own.</p>
      </section>
      <div style={{ marginTop: 20 }}><AppDirectory signedIn={!!user} /></div>
    </main>
  );
}
