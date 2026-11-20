# Jace Design

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fokjace%2Fjace-design&env=JACE_CLIENT_ID,JACE_CLIENT_SECRET,SESSION_SECRET,DATABASE_URL)

**Design anything, share it everywhere.** Jace Design is a free, open-source design tool — like Canva, but better — that uses **Sign in with Jace**.

- 🎨 **Real editor** — text with 20 fonts, shapes, lines & arrows, stickers, photos with filters, gradients, shadows, outlines, layers, lock/hide, snapping guides, rotate & resize, multi-page, undo/redo, keyboard shortcuts, speaker notes, present mode.
- 🧩 **Create tab** — 40+ sizes (social, video, presentations, docs, print, marketing), templates, custom sizes in px/in/cm/mm.
- 📥 **Imports** — images & SVGs (one page each), Jace Design files (`.jdesign.json`), Markdown/text outlines → slides, any public Jace Design link (remix), paste from clipboard, drag & drop.
- 🔗 **Share** — private / anyone-with-link / public, share with Jace users (view or edit), social share links, embed code.
- ⬇️ **Export** — PNG (incl. HD & transparent), JPG, SVG, multi-page PDF, Jace Design file.
- 🖨️ **Print** — paper sizes (A3/A4/A5/Letter/Legal/Tabloid/photo), orientation, fit or actual size, margins, crop marks, page ranges, copies.
- 👤 **Public profiles** — bio, website, followers, liked designs; Explore feed with search, popular and following tabs; likes, comments, remixes.
- 📧 **Emails with Jace** — comment, remix, follow and share notifications sent through Jace's email API (Jace Design never sees anyone's address), plus a **Send test email** button in Settings.

## Running it

You need Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Without `DATABASE_URL` it uses an embedded Postgres (PGlite) stored in `.data/`, so local development needs no database server.

### Environment variables

| Name | What it is |
| --- | --- |
| `JACE_CLIENT_ID` / `JACE_CLIENT_SECRET` | From your Jace account → Manage account → Developer. Register the redirect URI `https://YOUR-DOMAIN/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for development). Emails need the app to be an **official** Jace app. |
| `SESSION_SECRET` | Any long random string, used to sign session cookies. |
| `DATABASE_URL` | Postgres connection string. On Vercel, add **Neon** from the Storage tab and this is set for you. Tables are created automatically. |
| `APP_URL` | Optional. The public URL, used for links in emails. |

## Deploying to Vercel

1. Import this repository in Vercel (framework: Next.js, no settings to change).
2. Storage → Create database → **Neon (Postgres)** and connect it to the project.
3. Add `JACE_CLIENT_ID`, `JACE_CLIENT_SECRET` and `SESSION_SECRET` under Settings → Environment Variables.
4. Add `https://<your-project>.vercel.app/api/auth/callback` as a redirect URI on your Jace app, then redeploy.

## How it's built

- Next.js (App Router), plain CSS, no UI framework.
- Designs are JSON (`lib/design.js`): pages of elements (text, shape, line, image). One SVG renderer (`components/DesignPage.jsx`) draws them everywhere — editor, thumbnails, viewer, print — and a Canvas renderer (`lib/export.js`) makes PNG/JPG/PDF files.
- Sign in with Jace is standard OAuth 2.0 (`app/api/auth/*`); people using Jace Browser are signed in silently with `prompt=none`.
- Emails go through `POST https://jaceo.vercel.app/api/oauth/email` with the app's client credentials (`lib/jace.js`).

## Contributing

Issues and pull requests are welcome. Keep it simple and keep it fast.

## License

[MIT](LICENSE)
