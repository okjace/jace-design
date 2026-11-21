# Jace Design desktop — changelog

## 1.0.1

- Fixed: on some Linux computers (Intel graphics on Wayland) the window stayed empty. The page is now drawn without
  the GPU there, which always works.
- Dark mode: the app now tells Jace Design when your computer is in dark mode, so the site follows it
  (you can also pick Light / Dark / System on the site itself).

## 1.0.0

The first Jace Design desktop app.

- Jace Design in its own window on Windows, macOS (Apple Silicon and Intel) and Linux
- Stays signed in to your Jace account between restarts
- Downloads (PNG, PDF, Word…) ask where to save, like a browser
- Present goes properly fullscreen; File → Print uses your printer
- Links to other websites open in your normal browser
- Same installer as Jace Launcher: Start menu / Dock / applications menu, desktop shortcut, easy uninstall
- One-click updates from GitHub Releases
