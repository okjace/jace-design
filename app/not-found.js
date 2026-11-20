import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="page center">
      <p style={{ fontSize: 64, margin: 0 }}>🫥</p>
      <h1>Nothing here</h1>
      <p className="muted">This page doesn&apos;t exist, or the design is private.</p>
      <Link className="btn btn-primary" href="/">Go home</Link>
    </main>
  );
}
