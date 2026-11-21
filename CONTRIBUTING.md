# Contributing to Jace Design

Thanks for helping! Jace Design is free and open source (MIT), and contributions of every size are welcome:
bug reports, ideas, templates, translations, docs and code.

## Ways to help

- **Report a bug** — open an issue with what you did, what you expected and what happened (screenshots help).
- **Suggest a feature** — open an issue and describe the problem it solves.
- **Send a pull request** — small, focused changes are easiest to review.

## Running it on your computer

The website (Next.js):

```bash
npm install
cp .env.example .env.local   # fill in what you need; everything optional for local work except sign-in
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL` it uses an embedded Postgres (PGlite) in `.data/`, so you don't need a database server.
To sign in locally, register a Jace app with the redirect URI `http://localhost:3000/api/auth/callback`.

The desktop app (Python + Qt):

```bash
cd desktop
python -m venv .venv && .venv/bin/pip install -r requirements.txt pillow
.venv/bin/python packaging/make_icons.py
.venv/bin/python packaging/entry.py
```

## Where things live

| Folder | What's inside |
| --- | --- |
| `app/` | Pages and API routes (Next.js App Router) |
| `components/` | The editors (`Editor`, `DocEditor`, `SheetEditor`), viewer, share window, inbox… |
| `lib/` | The design model (`design.js`), renderers/exporters (`export.js`, `video.js`), formulas (`sheet.js`), AI prompts (`ai.js`), access rules (`access.js`) |
| `desktop/` | The desktop app, its installer and build scripts |
| `.github/workflows/` | CI for the website and the desktop builds/releases |

## Guidelines

- Keep it simple and fast; avoid adding big dependencies.
- Everything user-facing should be clear to someone who isn't technical.
- Never trust input from the browser: check permissions on the server (`lib/access.js`) and clean HTML (`lib/sanitize.js`).
- Run `npm run build` before opening a pull request. CI builds every push.

## Releasing the desktop app

Bump `APP_VERSION` in `desktop/jdesign/__init__.py`, add a section to `desktop/CHANGELOG.md`, and push to `main`.
GitHub Actions builds Windows, macOS and Linux, tests the installers, and publishes the release.

By contributing you agree that your contributions are licensed under the MIT License.
