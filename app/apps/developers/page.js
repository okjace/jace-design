import Link from 'next/link';

export const metadata = { title: 'Making Jace Design apps' };

const EXAMPLE = `<!doctype html>
<html>
<body>
  <h3>Big hello</h3>
  <input id="t" value="Hello!">
  <button id="add">Add to design</button>
  <script>
    let design = null;
    // 1. Say you're ready; Jace Design answers with "hello".
    parent.postMessage({ jaceDesign: 'ready' }, '*');
    addEventListener('message', (e) => {
      if (e.data && e.data.jaceDesign === 'hello') design = e.data.design; // { width, height, kind }
    });
    // 2. Send things to add.
    document.getElementById('add').onclick = () => {
      parent.postMessage({ jaceDesign: 'insert', text: { text: document.getElementById('t').value, fontSize: 96, color: '#1f9d5a', fontFamily: 'Poppins', fontWeight: 700 } }, '*');
    };
  </script>
</body>
</html>`;

export default function DevelopersPage() {
  return (
    <main className="page page-narrow" style={{ maxWidth: 820 }}>
      <h1>🧰 Making apps for Jace Design</h1>
      <p>An app is a web page you host anywhere on <b>https://</b> (GitHub Pages, Vercel, Netlify…). In the editor it opens in a window next to the design, and it talks to Jace Design with <code>postMessage</code>. Then <Link href="/apps/new" style={{ textDecoration: 'underline' }}>add it here</Link>.</p>

      <h2>What an app can do</h2>
      <p>Apps can only <b>add things</b> to the design. They run in a locked-down frame: they can’t see the rest of the design, your account or your cookies.</p>

      <h3>Messages your app sends (to <code>parent</code>)</h3>
      <table className="doc-table">
        <tbody>
          <tr><td><code>{`{ jaceDesign: 'ready' }`}</code></td><td>Ask for the design’s size. Jace Design answers with <code>{`{ jaceDesign: 'hello', version: 1, design: { width, height, kind }, selection }`}</code>, where <code>selection</code> is <code>{`{ type, text }`}</code> for selected text or <code>null</code>.</td></tr>
          <tr><td><code>{`{ jaceDesign: 'insert', text: {…} }`}</code></td><td>Add text. <code>text</code>, and optionally <code>fontSize</code>, <code>fontFamily</code> (any Google Font), <code>fontWeight</code>, <code>color</code>, <code>align</code>, <code>bgColor</code>, <code>x</code>, <code>y</code>, <code>w</code>.</td></tr>
          <tr><td><code>{`{ jaceDesign: 'insert', image: { src } }`}</code></td><td>Add a picture. <code>src</code> is a <code>data:image/…</code> URL (PNG, JPG, WebP, GIF or SVG, up to about 6 MB), or an https link that allows CORS.</td></tr>
          <tr><td><code>{`{ jaceDesign: 'insert', elements: [ … ], width, height }`}</code></td><td>Add several things at once: text, shapes, lines, charts, tables, QR codes and icons, in the same JSON the AI tools use (see the AI tab’s prompts). <code>width</code>/<code>height</code> say what size you laid them out for; they’re scaled to fit.</td></tr>
          <tr><td><code>{`{ jaceDesign: 'close' }`}</code></td><td>Close your app’s window.</td></tr>
        </tbody>
      </table>

      <h2>A complete example</h2>
      <pre className="code-block">{EXAMPLE}</pre>

      <h2>Rules</h2>
      <ul>
        <li>Your page must work inside an iframe (don’t send <code>X-Frame-Options: DENY</code> or a <code>frame-ancestors</code> that blocks Jace Design).</li>
        <li>The frame allows scripts, forms, popups and downloads, but not same-origin access, so use <code>localStorage</code> sparingly (it may not be available).</li>
        <li>Be kind: no tracking people, no collecting personal information without saying so, nothing harmful. Apps that break these rules are removed.</li>
      </ul>
      <p><Link className="btn btn-primary" href="/apps/new">＋ Make an app</Link></p>
    </main>
  );
}
