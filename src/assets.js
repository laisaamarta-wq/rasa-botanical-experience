// Every image is resolved through this manifest. In the web build they are hashed files
// (lazy-loaded); in the single-file local build Vite inlines them as data URIs.
const all = import.meta.glob('./assets/**/*.webp', { eager: true, query: '?url', import: 'default' });

export const A = {};
for (const [path, url] of Object.entries(all)) {
  const key = path.replace('./assets/', '').replace('.webp', '').replace('m/', 'm_').replace('tt/', 'tt_').replace('drp/', 'drp_');
  A[key] = url;
}

export const isMobile = () => matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)').matches;

// Images for the film are decoded OFF the main thread (createImageBitmap), so handing one to the GPU
// never stalls a frame on a decode. Only the compressed file is cached; every call returns a fresh,
// already-decoded bitmap that the caller closes after upload. Browsers without it fall back to <img>.
const bitmaps = typeof createImageBitmap === 'function';
const blobs = new Map();
const fetchBlob = (key) => {
  if (!blobs.has(key)) {
    const p = fetch(A[key]).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); });
    p.catch(() => blobs.delete(key));
    blobs.set(key, p);
  }
  return blobs.get(key);
};
function viaImg(key) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im));
    im.onerror = rej;
    im.src = A[key];
  });
}
export async function loadImage(key) {
  if (!bitmaps) return viaImg(key);
  try { return await createImageBitmap(await fetchBlob(key)); }
  catch { return viaImg(key); }
}
export const forget = (key) => blobs.delete(key);
// film frames: same off-thread decode; `prefetchFrame` only brings the small compressed file in
export const loadFrame = loadImage;
export const prefetchFrame = (key) => { if (bitmaps) fetchBlob(key).catch(() => {}); };

// Lazy DOM images: <img data-src="key"> / <source data-src="key">, loaded shortly before they scroll into view
export function lazyImages(root = document) {
  const els = [...root.querySelectorAll('[data-src]')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const pic = e.target.closest('picture');
      const targets = pic ? [...pic.querySelectorAll('[data-src]')] : [e.target];
      for (const t of targets) {
        const k = t.dataset.src;
        if (t.tagName === 'SOURCE') t.srcset = A[k]; else t.src = A[k];
        t.removeAttribute('data-src');
        io.unobserve(t);
      }
    }
  }, { rootMargin: '150% 0px' });
  els.forEach((el) => io.observe(el));
}
