import './style.css';
import { A, isMobile } from './assets.js';
import { createStage, U_MAX, HOTSPOTS, DRP_LAND, clamp, seg, sm, ioc, lerp } from './stage.js';
import { initShop } from './shop.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QA = location.search.includes('qa');
const mobile = isMobile();

// ---------- scroll hierarchy ----------
// How much scroll each part of the film gets (vh of scroll per unit of film time).
// Optical transitions are SHORT (6), camera moves and discoveries MEDIUM (8–9),
// the moments that carry the story LONG (11–14): the four plants, the product reveal and its hold.
const SEGS = [
  [0, 3, 10], [3, 9, 8],                       // 01 enter: let the first frame land
  [9, 14, 7], [14, 19, 9], [19, 23, 7], [23, 27, 9], [27, 30.5, 6],   // 02 the source: lens · leaf · lens · heather · push
  [30.5, 35, 9], [35, 39, 7], [39, 45, 12],    // 03 cloudberry · pull back · the bog and its four plants
  [45, 51, 10], [51, 58, 14],                  // 04 the bottle grows out of the moss · HERO HOLD
  [58, 62.5, 6], [62.5, 70, 9], [70, 75, 7],   // 05 into the glass · macro · follow the pipette
  [75, 86, 9], [86, 90, 6], [90, 95.5, 8], [95.5, 101.5, 9],          // 06 three drops · dive · reveal · turn
  [101.5, 106, 6], [106, 113.5, 9], [113.5, 117, 6], [117, 124, 8],    // 07 amber → light · cloudberry · tilt · moss
  [124, 129, 6], [129, 133, 8], [133, 137, 6], [137, 143, 8],          //    mist · birch · lens · heather
  [143, 151, 8], [151, 158.4, 9], [158.4, 168, 9],                     // 08 formula · INCI · 09 ritual
  [168, 172, 6], [172, 186, 8], [186, 200, 8],                         // 10 shop · 11 return
];
const SCALE = mobile ? 0.8 : 1;
const D0 = []; let TOTAL = 0;
for (const s of SEGS) { D0.push(TOTAL); TOTAL += (s[1] - s[0]) * s[2]; }
const uToD = (u) => { for (let i = SEGS.length - 1; i >= 0; i--) if (u >= SEGS[i][0]) return D0[i] + (Math.min(u, SEGS[i][1]) - SEGS[i][0]) * SEGS[i][2]; return 0; };
const dToU = (d) => { for (let i = SEGS.length - 1; i >= 0; i--) if (d >= D0[i]) return Math.min(SEGS[i][1], SEGS[i][0] + (d - D0[i]) / SEGS[i][2]); return 0; };

const film = $('#film'), stageEl = $('#stage'), loader = $('#loader');
film.style.height = `${(TOTAL * SCALE + 100).toFixed(1)}vh`;

let stage = null;
try {
  stage = createStage({
    canvas: $('#gl'), stage: stageEl,
    onProgressLoad: (p) => { loader.firstElementChild.style.transform = `scaleX(${p})`; if (p >= 1) loader.classList.add('is-done'); },
  });
} catch (e) { console.error(e); }
if (!stage) { stageEl.style.background = `center/cover url(${A.f_bog_product})`; loader.classList.add('is-done'); }

// write a style only when it changes (the loop runs every frame)
const css = (el, k, v) => { const c = el._c || (el._c = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } };

// ---------- overlays: every caption, label and panel lives on the film's clock ----------
const overlays = $$('[data-u]', stageEl).map((el) => {
  const [a, b] = el.dataset.u.split(',').map(Number);
  let pin = null;
  if (el.dataset.pin) { const [pl, xy] = el.dataset.pin.split(':'); pin = { pl, p: xy.split(',').map(Number) }; el.classList.add(el.dataset.side === 'l' ? 'is-left' : 'is-right'); }
  const still = el.classList.contains('shopcard');
  return { el, a, b, pin, still, live: false };
});
const intro = { el: $('[data-k="intro"]', stageEl), cue: $('[data-k="cue"]', stageEl) };

const hotRoot = $('#hot');
const hots = HOTSPOTS.map((h) => {
  const el = document.createElement('div');
  el.className = 'hs' + (h.left ? ' is-left' : '');
  el.innerHTML = `<span class="hs__dot"></span><span class="hs__line"></span><span class="hs__txt"><b>${h.n}</b><span>${h.l}</span></span>`;
  hotRoot.appendChild(el);
  return { ...h, el };
});

const dropMarks = $$('.drops__i', stageEl);
const orbs = $$('.orb', stageEl);
orbs.forEach((o) => { const im = o.querySelector('img'); im.src = A[im.dataset.key]; });

// ---------- chapters: label, index, address bar ----------
// [starts at, number, title, slug, where a jump lands]
const CHAPTERS = [
  [0, '01', 'Enter the world', 'enter', 0],
  [9, '02', 'The source', 'source', 14.6],
  [30.5, '03', 'The ingredient', 'ingredient', 31.6],
  [45, '04', 'Meet the product', 'product', 52.5],
  [58, '05', 'Inside the product', 'inside', 65.5],
  [74, '06', 'Three drops', 'drops', 75.8],
  [101.5, '07', 'Four plants', 'plants', 106.8],
  [143, '08', 'The formula', 'formula', 152.4],
  [158.4, '09', 'The ritual', 'ritual', 164.4],
  [168, '10', 'Shop', 'shop', 176],
  [186, '11', 'Return to nature', 'end', 199.6],
];
const chapterAt = (u) => { let c = CHAPTERS[0]; for (const ch of CHAPTERS) if (u >= ch[0] - 0.001) c = ch; return c; };
const chapter = $('#chapter'), hdr = $('#hdr'), progressBar = $('#progress');
const index = $('#index'), indexList = $('#indexList');
indexList.innerHTML = CHAPTERS.map((c) => `<li><a href="#${c[3]}" data-go="${c[4]}" data-slug="${c[3]}"><span>${c[1]}</span>${c[2]}</a></li>`).join('');
const indexLinks = $$('a', indexList);

let curSlug = null;
function setChapter(u) {
  const c = chapterAt(u), key = c[3] + (u < 1 ? '0' : '');
  if (curSlug === key) return;
  const sameChapter = curSlug && curSlug.startsWith(c[3]); curSlug = key;
  if (sameChapter) { try { history.replaceState({ u: c[4] }, '', u < 1 ? location.pathname + location.search : '#' + c[3]); } catch {} return; }
  chapter.style.opacity = 0;
  setTimeout(() => { chapter.querySelector('.chapter__n').textContent = c[1]; chapter.querySelector('.chapter__t').textContent = c[2]; chapter.style.opacity = ''; }, 260);
  indexLinks.forEach((a) => a.classList.toggle('is-on', a.dataset.slug === c[3]));
  // keep the address in step with the story, without filling the history
  try { history.replaceState({ u: c[4] }, '', u < 1 ? location.pathname + location.search : '#' + c[3]); } catch {}
}
function openIndex(on) {
  index.hidden = !on; chapter.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) indexLinks.find((a) => a.classList.contains('is-on'))?.focus({ preventScroll: true });
}
chapter.addEventListener('click', () => openIndex(index.hidden));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !index.hidden) { openIndex(false); chapter.focus(); } });
addEventListener('pointerdown', (e) => { if (!index.hidden && !e.target.closest('#index, #chapter')) openIndex(false); });

function place(el, x, y, s = 1) { css(el, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`); }

function updateOverlays(u, S, introT) {
  const { W, H } = stage ? stage.size : { W: innerWidth, H: innerHeight };
  for (const o of overlays) {
    const op = Math.min(sm(seg(u, o.a, o.a + 1)), 1 - sm(seg(u, o.b - 1, o.b)));
    if (op <= 0.001) {
      if (o.live !== null) { css(o.el, 'opacity', '0'); o.el.classList.remove('is-live'); o.live = null; }
      continue;
    }
    css(o.el, 'opacity', op.toFixed(2));
    const live = op > 0.6; if (live !== o.live) { o.el.classList.toggle('is-live', live); o.live = live; }
    if (o.pin && S && stage) {
      const p = stage.project(S, o.pin.pl, o.pin.p);
      if (p) place(o.el, p[0] * W, p[1] * H);
    } else if (!o.still) css(o.el, 'translate', `0 ${((1 - op) * 14).toFixed(1)}px`);
  }
  // intro
  const io = Math.min(sm(seg(introT, 0.35, 1)), 1 - sm(seg(u, 0.6, 3.2)));
  css(intro.el, 'opacity', io.toFixed(2)); css(intro.el, 'translate', `0 ${(-u * 8).toFixed(1)}px`);
  css(intro.cue, 'opacity', io.toFixed(2));

  // hotspots pinned to the bog
  if (S && u > 39 && u < 46) {
    for (const h of hots) {
      const p = stage.project(S, 'E', h.p); if (!p) continue;
      const on = mobile ? sm(clamp(1 - Math.abs(p[0] - 0.5) * 3.2)) : sm(seg(u, h.at, h.at + 1));
      const op = on * (1 - sm(seg(u, 44.2, 45.4)));
      if (mobile) h.el.classList.toggle('is-left', p[0] > 0.5);
      place(h.el, p[0] * W, p[1] * H); css(h.el, 'opacity', op.toFixed(2));
    }
  } else hots.forEach((h) => css(h.el, 'opacity', '0'));

  // three drops counted as they land
  dropMarks.forEach((d, i) => d.classList.toggle('is-on', u >= 75 + DRP_LAND[i] * 11));

  // the formula: four plants arrive one by one, circle, then fall into one point where the bottle appears
  if (u > 143.4 && u < 151) {
    const cx = (mobile ? 0.5 : 0.64) * W, cy = 0.47 * H, R = Math.min(W, H) * (mobile ? 0.3 : 0.27);
    const from = [[-0.2, 0.3], [1.2, 0.15], [-0.1, 1.15], [1.15, 0.9]];
    orbs.forEach((o, i) => {
      const tin = ioc(seg(u, 144 + i * 0.8, 145.6 + i * 0.8));
      const conv = ioc(seg(u, 148.7, 150.3));
      const ang = -Math.PI / 2 + i * Math.PI / 2 + (u - 143) * 0.12;
      const rx = cx + Math.cos(ang) * R * (1 - conv), ry = cy + Math.sin(ang) * R * 0.8 * (1 - conv);
      const x = lerp(from[i][0] * W, rx, tin), y = lerp(from[i][1] * H, ry, tin);
      const sz = o.offsetWidth || 120;
      css(o, 'transform', `translate3d(${(x - sz / 2).toFixed(1)}px,${(y - sz / 2).toFixed(1)}px,0) scale(${lerp(1, 0.18, conv).toFixed(3)})`);
      css(o, 'opacity', (tin * (1 - sm(seg(u, 149.6, 150.4)))).toFixed(2));
      o.classList.toggle('is-near', conv > 0.05);
    });
  } else orbs.forEach((o) => css(o, 'opacity', '0'));
}

// ---------- drag the bottle while it is on screen ----------
const canDrag = () => stage && uS > 90 && uS < 168;
let dragging = false, lastX = 0;
stageEl.addEventListener('pointerdown', (e) => {
  if (!canDrag() || e.pointerType === 'touch' || e.target.closest('.shopcard, a, button')) return;
  dragging = true; lastX = e.clientX; stageEl.classList.add('is-dragging');
});
addEventListener('pointermove', (e) => { if (!dragging || !stage) return; stage.drag.v = clamp(stage.drag.v + (e.clientX - lastX) / innerWidth * 2.2, -1.6, 1.6); lastX = e.clientX; });
const endDrag = () => { dragging = false; stageEl.classList.remove('is-dragging'); };
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);

// ---------- clock ----------
// uS follows the scroll position with a little inertia (the camera has weight); it never runs ahead of the user.
// `motion` is how fast the camera is actually moving: motion blur follows it, so a stopped camera is a sharp camera.
let uS = 0, introStart = 0, introT = 0, last = performance.now(), motion = QA ? 1 : 0.3, snapNext = false;
stage?.firstReady.then(() => { introStart = performance.now(); });
const filmProgress = () => {
  const r = film.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - stageEl.clientHeight));
};
function frame(now) {
  const rdt = Math.min(0.5, Math.max(0.001, (now - last) / 1000)); last = now;
  const dt = Math.min(0.05, rdt);
  const k = reduced || QA ? 1 : 1 - Math.exp(-dt * 7);
  const target = dToU(filmProgress() * TOTAL);
  const prev = uS, cut = snapNext || Math.abs(target - uS) > 40;
  uS = cut ? target : uS + (target - uS) * k;
  if (Math.abs(target - uS) < 0.002) uS = target;
  snapNext = false;
  if (!QA && !cut) {                                            // a cut is not camera movement
    const vel = Math.abs(uS - prev) / dt;                       // film units per second
    const want = clamp(0.25 + vel / 9, 0.25, 1);
    motion += (want - motion) * (1 - Math.exp(-rdt * (want > motion ? 10 : 2.6)));
  }
  if (introStart) introT = reduced || QA ? 1 : clamp((now - introStart) / 2400);
  if (stage && !dragging) stage.drag.v *= 0.93;
  const r = film.getBoundingClientRect();
  if (r.bottom > 0) {
    const S = stage ? stage.render(uS, now / 1000, introT, { motion, ahead: Math.abs(target - uS) }) : null;
    updateOverlays(uS, S, introT);
  }
  hdr.classList.toggle('is-hidden', introT < 0.9 && uS < 1);
  setChapter(uS);
  // the chapter label steps aside for the intro, the shop card and the footer
  chapter.classList.toggle('is-hidden', (uS > 171 && uS < 187) || uS < 2.8 || r.bottom < innerHeight - 4);
  stageEl.classList.toggle('can-drag', !!canDrag() && !mobile);
  css(progressBar, 'transform', `scaleX(${(uS / U_MAX).toFixed(4)})`);
  requestAnimationFrame(frame);
}

// ---------- navigation: every link is a position in the film ----------
const yFor = (u) => film.offsetTop + (uToD(clamp(u, 0, U_MAX)) / TOTAL) * (film.offsetHeight - stageEl.clientHeight);
function goTo(u, instant = false) {
  const top = yFor(u);
  const far = Math.abs(top - scrollY) > innerHeight * 4;
  if (instant || far || reduced) snapNext = true;          // long jumps cut; short ones travel
  scrollTo({ top, behavior: instant || far || reduced ? 'auto' : 'smooth' });
}
// jumps are real history entries, so Back returns to where you were
function jump(u, slug) {
  try {
    history.replaceState({ u: uS }, '', location.hash || location.pathname + location.search);
    history.pushState({ u }, '', slug ? '#' + slug : location.pathname + location.search);
  } catch {}
  goTo(u);
}
addEventListener('popstate', (e) => {
  const u = e.state && typeof e.state.u === 'number' ? e.state.u : (CHAPTERS.find((c) => '#' + c[3] === location.hash)?.[4] ?? 0);
  goTo(u, true);
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]'); if (!a) return;
  e.preventDefault(); openIndex(false);
  const u = +a.dataset.go;
  jump(u, a.dataset.slug || chapterAt(u)[3]);
});

// arriving on a chapter address (#formula, #shop …) lands there
const fromHash = CHAPTERS.find((c) => '#' + c[3] === location.hash);
if (fromHash) { history.scrollRestoration = 'manual'; requestAnimationFrame(() => goTo(fromHash[4], true)); }

addEventListener('resize', () => stage?.resize());
initShop();
requestAnimationFrame(frame);
window.__rasa = { get u() { return uS; }, U_MAX, goTo, uToD, dToU, get stats() { return stage?.stats; } };
