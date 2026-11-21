# Jace Design

[![CI](https://github.com/okjace/jace-design/actions/workflows/ci.yml/badge.svg)](https://github.com/okjace/jace-design/actions/workflows/ci.yml)
[![Desktop app](https://github.com/okjace/jace-design/actions/workflows/desktop.yml/badge.svg)](https://github.com/okjace/jace-design/actions/workflows/desktop.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1f9d5a.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fokjace%2Fjace-design&env=JACE_CLIENT_ID,JACE_CLIENT_SECRET,SESSION_SECRET,DATABASE_URL)

**Design anything, share it everywhere.** Jace Design is a free, **open-source** design app — like Canva, but better —
with **Sign in with Jace**. Use it at **[jace-design.vercel.app](https://jace-design.vercel.app)** or download the desktop app.

## What you can make

| Kind | What it does |
| --- | --- |
| 🎨 **Designs** | Posts, slides, posters, cards, logos… Text with ~280 fonts (or your own), shapes, photos with filters, pen, sticky notes, layers, blend modes, presenting |
| 🎬 **Videos** | Scenes with transitions, animated text and shapes, music; play it and download an MP4 |
| 📄 **Documents** | Word-style: headings, lists, tables, images, page setup; import `.docx`, download Word/PDF |
| 📊 **Spreadsheets** | Cells, formulas (`=SUM(A1:A5)`, `IF`, `AVERAGE`…), formatting, multiple sheets, CSV import/export |
| 🌐 **Websites** | Sections with links and a menu, published at their own address |
| 🧠 **Whiteboards** | Big canvas, sticky notes, pen, mind maps and kanban boards |

Plus: templates (yours and the community's), free photo search (Openverse + Wikimedia Commons), AI help with any AI you like,
sharing with view / comment / edit / custom permissions, ask-for-access, guests with names, Jace Social sharing,
an inbox with live updates, comments, likes, remixes, public profiles, printing and every common download format.

## Desktop app

Download it from **[Releases](https://github.com/okjace/jace-design/releases/latest)**:
Windows (`.exe`), macOS Apple Silicon / Intel (`.app.zip`) and Linux (`.AppImage`).
Open the download once and it installs itself (Start menu / Dock / applications menu, desktop shortcut), keeps you signed in,
and updates with one click. It uses the same installer as [Jace Launcher](https://github.com/okjace/jace-launcher).

## Running the website yourself

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
| `JACE_CLIENT_ID` / `JACE_CLIENT_SECRET` | From your Jace account → Manage account → Developer. Register the redirect URI `https://YOUR-DOMAIN/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for development). Emails and Jace Social sharing need the app to be an **official** Jace app. |
| `SESSION_SECRET` | Any long random string, used to sign session cookies and encrypt stored tokens. |
| `DATABASE_URL` | Postgres connection string. With **Supabase** (free plan), open your project → **Connect** → copy the **Transaction pooler** URI (port 6543). Any Postgres works. Tables are created automatically. |
| `APP_URL` | Optional. The public URL, used for links in emails. |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | Optional. Turns on built-in AI using a free tier: [Google Gemini](https://aistudio.google.com/apikey), [Groq](https://console.groq.com/keys) or [OpenRouter](https://openrouter.ai/keys). Set any of them; they're tried in that order. Without one, the AI tools use copy-and-paste with ChatGPT, Claude or Gemini. |
| `GEMINI_MODEL` / `GROQ_MODEL` / `OPENROUTER_MODEL` / `AI_DAILY_LIMIT` | Optional. Pick models yourself (otherwise a current free model is chosen automatically) and AI requests per person per day (default 40). |

### Deploying to Vercel

1. Import this repository in Vercel (framework: Next.js, no settings to change).
2. Create a free **Supabase** project and copy its Transaction pooler connection string.
3. Add `DATABASE_URL`, `JACE_CLIENT_ID`, `JACE_CLIENT_SECRET` and `SESSION_SECRET` under Settings → Environment Variables.
4. Add `https://<your-project>.vercel.app/api/auth/callback` as a redirect URI on your Jace app, then redeploy.

## How it's built

- Next.js (App Router), plain CSS, no UI framework; Postgres for storage.
- Designs are JSON (`lib/design.js`). One SVG renderer (`components/DesignPage.jsx`) draws them everywhere, and a Canvas
  renderer (`lib/export.js`) makes PNG / JPG / PDF files and video frames (`lib/video.js`).
- Sign in with Jace is standard OAuth 2.0 (`app/api/auth/*`). Emails go through Jace's email API (`lib/jace.js`).
- The desktop app (`desktop/`) is Python + Qt WebEngine, built and released by GitHub Actions.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — free to use, change and share.
