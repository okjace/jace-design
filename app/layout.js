import './globals.css';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { GOOGLE_FONTS_HREF } from '@/lib/design';
import UserMenu from '@/components/UserMenu';
import SilentSignIn from '@/components/SilentSignIn';

export const metadata = {
  title: { default: 'Jace Design', template: '%s · Jace Design' },
  description: 'Design anything — posts, slides, posters, cards and more. Free and open source, with Sign in with Jace.',
};

export default async function RootLayout({ children }) {
  const user = await getUser().catch(() => null);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <header className="topnav">
          <Link href="/" className="brand">
            <img src="/icon.svg" alt="" width="28" height="28" />
            <span>Jace <b>Design</b></span>
          </Link>
          <nav className="navlinks">
            <Link href="/">Home</Link>
            <Link href="/new">Create</Link>
            <Link href="/explore">Explore</Link>
          </nav>
          <div className="navright">
            {user ? (
              <>
                <Link href="/new" className="btn btn-primary btn-sm hide-sm">+ Create a design</Link>
                <UserMenu user={{ username: user.username, name: user.name, picture: user.picture }} />
              </>
            ) : (
              <a href="/api/auth/login" className="btn btn-jace btn-sm">Sign in with Jace</a>
            )}
          </div>
        </header>
        {!user ? <SilentSignIn /> : null}
        {children}
      </body>
    </html>
  );
}
