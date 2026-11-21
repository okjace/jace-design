'use client';
// Remove a photo's background right in the browser (nothing is uploaded), using the open-source
// BiRefNet-lite model (MIT license) through transformers.js. The model downloads once (~115 MB) and is cached.
const TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js';
const MODEL = 'onnx-community/BiRefNet_lite-ONNX';

let loading = null;
function load(onStatus) {
  if (!loading) {
    loading = (async () => {
      const tf = await import(/* webpackIgnore: true */ TF);
      tf.env.allowLocalModels = false;
      const progress_callback = (p) => {
        if (p.status === 'progress' && /\.onnx/.test(p.file || '')) onStatus?.(`Getting the background remover ready… ${Math.round(p.progress || 0)}% (only the first time, about 115 MB)`);
      };
      const tries = [
        ...(typeof navigator !== 'undefined' && navigator.gpu ? [{ device: 'webgpu', dtype: 'fp16' }] : []),
        { device: 'wasm', dtype: 'fp16' },
        { device: 'wasm', dtype: 'fp32' },
      ];
      let model = null, last = null;
      for (const t of tries) {
        try { model = await tf.AutoModel.from_pretrained(MODEL, { ...t, progress_callback }); break; } catch (e) { last = e; }
      }
      if (!model) throw last || new Error('Could not load the background remover.');
      const processor = await tf.AutoProcessor.from_pretrained(MODEL);
      return { tf, model, processor };
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/** Returns a PNG data URL of the image with its background made transparent. */
export async function removeBackground(src, onStatus) {
  onStatus?.('Getting the background remover ready…');
  const { tf, model, processor } = await load(onStatus);
  onStatus?.('Removing the background…');
  const image = await tf.RawImage.fromURL(src);
  const { pixel_values } = await processor(image);
  const inName = model.sessions?.model?.inputNames?.[0] || 'input_image';
  const out = await model({ [inName]: pixel_values });
  let t = (out.output_image || Object.values(out)[0])[0];
  // The model gives scores; squash them to 0..1 unless they already are.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < t.data.length; i += 97) { const v = t.data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  if (lo < -0.01 || hi > 1.01) t = t.sigmoid();
  const mask = await tf.RawImage.fromTensor(t.mul(255).to('uint8')).resize(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image.toCanvas(), 0, 0);
  const px = ctx.getImageData(0, 0, image.width, image.height);
  const step = mask.channels || 1;
  for (let i = 0; i < image.width * image.height; i++) px.data[i * 4 + 3] = mask.data[i * step];
  ctx.putImageData(px, 0, 0);
  // Keep it a sensible size for storing in the design.
  const s = Math.min(1, 1600 / Math.max(canvas.width, canvas.height));
  if (s < 1) {
    const c2 = document.createElement('canvas');
    c2.width = Math.round(canvas.width * s); c2.height = Math.round(canvas.height * s);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2.toDataURL('image/png');
  }
  return canvas.toDataURL('image/png');
}
