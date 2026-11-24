'use client';
// Load a design's custom fonts (uploaded font files + extra Google Fonts) into the page.

const loaded = new Set();

export function googleFontHref(family) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;700&display=swap`;
}

export async function loadGoogleFont(family) {
  if (typeof document === 'undefined' || !family) return false;
  const key = `g:${family}`;
  if (!loaded.has(key)) {
    loaded.add(key);
    // Ask for regular + bold; fonts that only come in one weight make Google reject that, so fall back.
    const name = encodeURIComponent(family).replace(/%20/g, '+');
    let css = '';
    for (const url of [googleFontHref(family), `https://fonts.googleapis.com/css2?family=${name}&display=swap`]) {
      try {
        const r = await fetch(url);
        if (r.ok) { css = await r.text(); break; }
      } catch {}
    }
    if (!css) { loaded.delete(key); return false; }
    const style = document.createElement('style');
    style.dataset.font = family;
    style.textContent = css;
    document.head.appendChild(style);
  }
  try {
    await document.fonts.load(`400 32px "${family}"`);
    return document.fonts.check(`400 32px "${family}"`);
  } catch {
    return false;
  }
}

export async function loadFontFile(family, src) {
  if (typeof document === 'undefined') return false;
  const key = `f:${family}:${src.length}`;
  if (loaded.has(key)) return true;
  try {
    const face = new FontFace(family, `url(${src})`);
    await face.load();
    document.fonts.add(face);
    loaded.add(key);
    return true;
  } catch {
    return false;
  }
}

export async function registerFonts(design) {
  if (!design) return;
  await Promise.all([
    ...(design.fonts || []).map((f) => loadFontFile(f.family, f.src)),
    ...(design.googleFonts || []).map((g) => loadGoogleFont(g)),
  ]);
}

export function fontFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[ext] || 'font/ttf';
      resolve(String(r.result).replace(/^data:[^;]*;/, `data:${mime};`));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
