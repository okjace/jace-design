'use client';
// Jace Photos: shrink a photo in the browser before uploading it, and make its small preview.

function load(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`“${file.name}” isn't a photo this browser can open.`)); };
    img.src = url;
  });
}

function draw(img, max, type, quality) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL(type, quality), width: c.width, height: c.height };
}

/** Returns { image, thumb, width, height, title } ready for POST /api/photos. */
export async function preparePhoto(file) {
  const { img, url } = await load(file);
  try {
    // PNGs keep their see-through parts; everything else becomes a JPEG.
    const png = file.type === 'image/png';
    let full = draw(img, 2000, png ? 'image/png' : 'image/jpeg', 0.86);
    if (full.url.length > 3_800_000) full = draw(img, 1600, 'image/jpeg', 0.82); // big PNGs: fall back to JPEG
    const thumb = draw(img, 360, 'image/jpeg', 0.72);
    const title = (file.name || 'Photo').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 100);
    return { image: full.url, thumb: thumb.url, width: full.width, height: full.height, title };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadPhoto(file, { isPublic = true, tags = '' } = {}) {
  const p = await preparePhoto(file);
  const r = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...p, tags, public: isPublic }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Upload failed.');
  return d.id;
}
