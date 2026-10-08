// Every image is resolved through this manifest. In the web build they are hashed files
// (lazy-loaded); in the single-file local build Vite inlines them as data URIs.
const all = import.meta.glob('./assets/**/*.webp', { eager: true, query: '?url', import: 'default' });

export const A = {};
for (const [path, url] of Object.entries(all)) {
  const key = path.replace('./assets/', '').replace('.webp', '').replace('m/', 'm_').replace('tt/', 'tt_').replace('drp/', 'drp_');
  A[key] = url;
}

export const isMobile = () => matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)').matches;

const cache = new Map();
export function loadImage(key) {
  if (cache.has(key)) return cache.get(key);
  const p = new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im));
    im.onerror = rej;
    im.src = A[key];
  });
  cache.set(key, p);
  return p;
}

export const forget = (key) => cache.delete(key);
// film frames: no forced decode, the GPU upload decodes on demand
export function loadFrame(key) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = A[key]; });
}

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
