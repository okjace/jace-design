import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth';
import { GOOGLE_FONTS_HREF } from '@/lib/design';
import UserMenu from '@/components/UserMenu';
import FontLoader from '@/components/FontLoader';
import InboxBell from '@/components/InboxBell';
import ThemeToggle from '@/components/ThemeToggle';
import TermsNotice from '@/components/TermsNotice';

export const metadata = {
  title: { default: 'Jace Design', template: '%s · Jace Design' },
  description: 'Design anything — posts, slides, posters, cards and more. Free and open source, with Sign in with Jace.',
};

export default async function RootLayout({ children }) {
  const user = await getUser().catch(() => null);
  // Light / Dark / System (default). "System" follows the device's setting through CSS.
  const saved = (await cookies()).get('jd_theme')?.value;
  const theme = saved === 'light' || saved === 'dark' ? saved : 'system';
  return (
    <html lang="en" data-theme={theme === 'system' ? undefined : theme} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content={theme === 'system' ? 'light dark' : theme} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Only the UI font blocks the first paint; the design fonts load in the background. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono&display=swap" />
        <link rel="preload" as="style" href={GOOGLE_FONTS_HREF} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <FontLoader href={GOOGLE_FONTS_HREF} />
        <header className="topnav">
          <Link href="/" className="brand">
            <img src="/icon.svg" alt="" width="28" height="28" />
            <span>Jace <b>Design</b></span>
          </Link>
          <nav className="navlinks">
            <Link href="/">Home</Link>
            <Link href="/new">Create</Link>
            <Link href="/explore">Explore</Link>
            <Link href="/photos">Photos</Link>
            <Link href="/apps">Apps</Link>
          </nav>
          <div className="navright">
            <ThemeToggle initial={theme} />
            {user ? (
              <>
                <Link href="/new" className="btn btn-primary btn-sm hide-sm">+ Create a design</Link>
                <InboxBell />
                <UserMenu user={{ username: user.username, name: user.name, picture: user.picture }} />
              </>
            ) : (
              <a href="/api/auth/login" className="btn btn-jace btn-sm">Sign in with Jace</a>
            )}
          </div>
        </header>
        {children}
        <TermsNotice />
      </body>
    </html>
  );
}
