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
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontHref(family);
    document.head.appendChild(link);
    await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
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
    if (file.size > 2_000_000) { reject(new Error('Font files must be under 2 MB.')); return; }
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
