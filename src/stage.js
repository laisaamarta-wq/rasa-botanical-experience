// RASA · the film
// The whole site is one camera move. A single full-screen WebGL pass composites at most two
// photographic plates per frame, and every transition is motivated by something physical:
//   mode 0 — crossfade through blur, light or colour (focus pulls, amber → light, mist)
//   mode 1 — dew lens: the next world is seen through a drop of water/sap that grows until it is the world
//   mode 2 — emergence: the bottle grows out of the moss, revealed from the ground up
// Everything is a pure function of one number, u (0 → U_MAX), driven by native scroll.
import { loadImage, loadFrame, forget, isMobile } from './assets.js';
import meta from './assets/meta.json';

export const U_MAX = 200;

// ---------- shader ----------
const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes;
uniform sampler2D uT0, uT1, uMask;
uniform vec4 uX0, uX1;
uniform vec4 uM0, uM1;           // motion blur per layer: centre.xy, zoom amount, unused
uniform vec2 uD0, uD1;           // directional (tilt/pan) blur per layer
uniform float uFog, uFogTop;
uniform vec2 uE;                 // per-layer: fade outside the plate into uBg (studio plates)
uniform vec3 uBg;
uniform float uB0, uB1, uMix, uK, uWipe;
uniform int uMode;
uniform vec4 uLens;
uniform float uExpo, uFade, uVig, uMist, uTime, uWarm, uAmber;
uniform vec3 uFadeCol;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }

vec3 samp(sampler2D t, vec2 su, vec4 X, float b, float edge, vec4 M, vec2 D){
  vec2 uv = su*X.xy + X.zw;
  vec3 c;
  if (M.z > 0.002 || dot(D,D) > 1e-6) {
    // camera motion: streak along the direction of travel (toward/away from a point, or a tilt)
    vec2 ts = vec2(textureSize(t,0));
    float lod = max(0., log2(max(b*X.y*ts.y, 1.)/4.));
    vec3 acc = vec3(0.); float h = hash(gl_FragCoord.xy);
    for (int i=0;i<14;i++){ float f = (float(i)+h)/14.;
      vec2 s2 = su + (M.xy - su)*M.z*f + D*(f-.5);
      acc += textureLod(t, s2*X.xy + X.zw, lod).rgb; }
    c = acc/14.;
  } else if (b < 0.0005) c = texture(t, uv).rgb;
  else {
    vec2 ts = vec2(textureSize(t,0));
    vec2 r = vec2(b*X.x*uRes.y/uRes.x, b*X.y);
    float lod = max(0., log2(r.y*ts.y/5.));
    vec3 acc = vec3(0.);
    for (int i=0;i<12;i++){ float fi=float(i)+.5; float rr=sqrt(fi/12.); float a=fi*2.39996;
      acc += textureLod(t, uv + vec2(cos(a),sin(a))*rr*r, lod).rgb; }
    c = acc/12.;
  }
  if (edge > .5) {
    vec2 d = max(-uv, uv-1.);
    float out_ = max(d.x, d.y);
    c = mix(c, uBg, smoothstep(-.16, .01, out_));
  }
  return c;
}

void main(){
  vec2 su = vec2(vUv.x, 1.-vUv.y);
  vec3 c0 = samp(uT0, su, uX0, uB0, uE.x, uM0, uD0);
  vec3 col = c0;

  if (uMode == 0) {
    if (uMix > 0.001) col = mix(c0, samp(uT1, su, uX1, uB1, uE.y, uM1, uD1), uMix);
  } else if (uMode == 1) {
    vec2 asp = vec2(uRes.x/uRes.y, 1.);
    vec2 P = su*asp, C = uLens.xy*asp;
    vec2 q = (P-C)/uLens.z; float r = length(q); float rr = min(r,1.);
    vec2 qf = q*mix(1., .38 + .62*rr*rr, uK);
    float ca = .022*uK*rr*rr;
    vec2 b0 = (C + qf*uLens.w*(1.-ca))/asp, b1 = (C + qf*uLens.w)/asp, b2 = (C + qf*uLens.w*(1.+ca))/asp;
    vec3 lc = vec3(texture(uT1, b0*uX1.xy+uX1.zw).r, texture(uT1, b1*uX1.xy+uX1.zw).g, texture(uT1, b2*uX1.xy+uX1.zw).b);
    float edge = smoothstep(.5, 1., rr);
    lc *= 1. - .6*edge*edge*uK;
    float ring = smoothstep(.84,.965,rr)*(1.-smoothstep(.965,1.,rr));
    lc += ring*uK*.42*vec3(1.,.96,.88)*(.35+.65*max(0., dot(q/(r+1e-4), vec2(.25,.97))));
    vec2 h = q - vec2(-.36,-.44); lc += uK*.6*exp(-dot(h,h)*42.)*vec3(1.,.99,.96);
    vec2 h2 = q - vec2(.28,.52); lc += uK*.1*exp(-dot(h2,h2)*16.);
    float aa = 2.2/(uLens.z*uRes.y);
    float m = 1. - smoothstep(1.-aa, 1., r);
    float sh = uK*.4*exp(-max(r-1.,0.)*7.)*step(1.,r);
    col = c0*(1.-sh);
    col = mix(col, lc, m*uMix);
  } else {
    vec2 uv1 = su*uX1.xy + uX1.zw;
    vec3 c1 = texture(uT1, uv1).rgb;
    float mk = texture(uMask, uv1).r;
    float line = mix(.56, .19, uWipe);
    float w = smoothstep(line-.012, line+.012, uv1.y);
    float a = max(mk*w, uMix);
    col = mix(c0, c1, a);
    float g = exp(-pow((uv1.y-line)/.012, 2.))*mk*(1.-uMix);
    col += g*vec3(1., .78, .45)*.55;
  }

  if (uMist > 0.001) {
    float n = fbm(vec2(su.x*2.2 + uTime*.018, su.y*4. - uTime*.006));
    float band = smoothstep(.78, .2, su.y)*smoothstep(0., .22, su.y);
    col += uMist*band*smoothstep(.35,.9,n)*vec3(.95,.86,.72)*.22;
  }
  // ground mist: it rises from below with a soft, wispy top edge and never becomes a flat wall
  if (uFog > 0.001) {
    vec2 q = su*vec2(1.5, 2.6);
    float n = fbm(q + vec2(uTime*.04, uTime*.01) + .6*fbm(q*1.8 - vec2(uTime*.025, 0.)));
    float n2 = fbm(q*3.1 + vec2(-uTime*.05, uTime*.02));
    float top = mix(1.15, uFogTop, uFog);
    float edge = su.y - top + (n - .5)*.32;
    float m = smoothstep(-.02, .2, edge);
    float a = m * (.62 + .36*n2) * min(1., uFog*1.25);
    vec3 fc = mix(vec3(.58,.57,.52), vec3(.97,.88,.74), smoothstep(.25,.85,n)) * (.9 + .2*n2);
    col = mix(col, fc, clamp(a, 0., .94));
  }
  // amber → light: the colour of the oil becomes warm daylight
  if (uAmber > 0.001) {
    vec3 sun = vec3(1., .78, .42);
    float l = dot(col, vec3(.3,.55,.15));
    col = mix(col, sun*(.5 + .95*l), uAmber*.72);
    col += uAmber*uAmber*vec3(1., .86, .62)*.3;
  }
  col *= uExpo;
  col = mix(col, col*vec3(1.05,1.,.92), uWarm);
  vec2 vq = (su-.5)*vec2(uRes.x/uRes.y*.75, 1.);
  col *= mix(1., smoothstep(1.05, .18, length(vq)), uVig);
  col = mix(col, uFadeCol, uFade);
  col += (hash(gl_FragCoord.xy + fract(uTime)*91.) - .5)*(2./255.);
  o = vec4(col, 1.);
}`;

// ---------- plates (points in source-image uv, 0..1, y down) ----------
const PL = {
  A: { key: 'a_drop', f: [0.495, 0.5] },
  B: { key: 'b_leaf', f: [0.6, 0.5] },
  C: { key: 'c_heather', f: [0.58, 0.5] },
  D: { key: 'd_cloudberry', f: [0.36, 0.5] },
  E: { key: 'e_bog', f: [0.5, 0.46], wide: true },
  F: { key: 'f_bog_product', f: [0.5, 0.46], wide: true },
  MAC: { key: 'macro', f: [0.6, 0.5], dom: true },
  IC: { key: 'i_cloudberry', f: [0.66, 0.4], dom: true },
  IM: { key: 'i_moss', f: [0.47, 0.6], dom: true },
  IB: { key: 'i_birch', f: [0.44, 0.5], dom: true },
  IH: { key: 'i_heather', f: [0.38, 0.5], dom: true },
  FIN: { key: 'final', f: [0.48, 0.5], dom: true },
  TT: { key: 'tt', dyn: true, free: true, w: 960, h: 960, f: [0.5, 0.52] },
  DRP: { key: 'drp', dyn: true, free: true, w: 1120, h: 630, f: [0.5, 0.5] },
};
// plate usage (u ranges) — drives texture streaming
const USE = {
  A: [[0, 14]], B: [[8, 23]], C: [[18, 31]], D: [[27, 39]], E: [[34, 52], [184, 200]], F: [[43, 63], [166, 194]],
  MAC: [[60, 75]], DRP: [[69, 91]], TT: [[87, 107], [143, 174]], IC: [[103, 118]], IM: [[112, 128]], IB: [[122, 138]],
  IH: [[132, 148]], FIN: [[190, 200]],
};
const P = {
  dropA: [0.495, 0.641, 0.122], dropB: [0.642, 0.719, 0.036], berry: [0.33, 0.42],
  bottle: [0.498, 0.25], oilF: [0.498, 0.31],
  macOil: [0.8, 0.5], macPip: [0.655, 0.8], macRasa: [0.623, 0.91], macGlass: [0.3, 0.55],
  drpTip: [0.497, 0.33], drpPool: [0.5, 0.88],
  ttOil: [0.5, 0.63], ttCenter: [0.5, 0.5], ttCap: [0.6, 0.2], ttBand: [0.6, 0.39], ttGlass: [0.73, 0.62],
  icLight: [0.1, 0.12], icBerry: [0.66, 0.3], icMoss: [0.56, 0.88],
  imMoss: [0.47, 0.66], imMist: [0.62, 0.1],
  ibMist: [0.78, 0.42], sap: [0.431, 0.537, 0.017], ibBark: [0.4, 0.5],
  ihBee: [0.35, 0.54],
};
export const HOTSPOTS = [
  { p: [0.5, 0.53], n: 'Sphagnum moss', l: 'The water keeper', at: 39.6 },
  { p: [0.846, 0.607], n: 'Cloudberry', l: 'The amber', at: 40.4, left: true },
  { p: [0.19, 0.2], n: 'Silver birch', l: 'The first water', at: 41.2 },
  { p: [0.285, 0.47], n: 'Heather', l: 'The late bloom', at: 42 },
];
// drop landing times inside the drops sequence (0..1 of the clip) — tuned to the footage
export const DRP_LAND = meta.drp ? meta.drp.land : [0.3, 0.6, 0.9];
const STUDIO = [0.082, 0.086, 0.04];
const INK = [0.031, 0.043, 0.035];

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (u, a, b) => clamp((u - a) / (b - a));
const sm = (t) => t * t * (3 - 2 * t);
const ioc = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const oc = (t) => 1 - Math.pow(1 - t, 3);
const ic = (t) => t * t * t;
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const bump = (u, a, m, b) => (u < a || u > b ? 0 : u < m ? sm(seg(u, a, m)) : 1 - sm(seg(u, m, b)));
const L = (pl, z, c, b = 0, zb = 0, zc = null, dir = null) => ({ pl, z, c, b, zb, zc, dir });
export { clamp, seg, sm, ioc, oc, lerp, bump };

export function createStage({ canvas, stage, onProgressLoad }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const mobile = isMobile();

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; const nU = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nU; i++) { const nm = gl.getActiveUniform(prog, i).name; U[nm] = gl.getUniformLocation(prog, nm); }
  gl.uniform1i(U.uT0, 0); gl.uniform1i(U.uT1, 1); gl.uniform1i(U.uMask, 2);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  // ---------- textures (streamed: only what the camera is near stays on the GPU) ----------
  const black = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, black);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 11, 9, 255]));
  function makeTex(img, mips = true) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso && mips) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }
  for (const [id, pl] of Object.entries(PL)) {
    pl.id = id;
    if (pl.dyn) continue;
    pl.useM = mobile;
    pl.src = mobile ? 'm_' + pl.key : pl.key;
    pl.crop = mobile && !pl.wide ? meta[pl.key] : null;
    if (pl.wide) { pl.ext = meta.ext; pl.w = mobile ? 1920 : 2560; pl.h = Math.round(pl.w * meta.ext.h / 2560); }
    else if (mobile) { pl.w = 1080; pl.h = 1920; }
    else { pl.w = pl.dom ? 2400 : 2560; pl.h = pl.dom ? 1350 : 1440; }
  }
  const tex = {}, loading = {};
  const BUDGET = mobile ? 6 : 14;
  function rangesNear(id, u, back, ahead) { return USE[id].some(([a, b]) => b >= u - back && a <= u + ahead); }
  function distTo(id, u) { return Math.min(...USE[id].map(([a, b]) => (u < a ? a - u : u > b ? u - b : 0))); }
  async function ensure(id) {
    if (tex[id] || loading[id]) return;
    loading[id] = true;
    try { const img = await loadImage(PL[id].src); pending.push([id, img]); }
    catch (e) { loading[id] = false; }
  }
  // GPU uploads (with mipmaps) are the expensive part: at most one per frame, nearest plate first,
  // so a fast scroll never stalls a frame on several uploads at once
  const pending = [];
  function upload(u) {
    if (!pending.length) return;
    pending.sort((a, b) => distTo(a[0], u) - distTo(b[0], u));
    const [id, img] = pending.shift();
    tex[id] = makeTex(img); loading[id] = false; stats.uploads++;
  }
  const stats = { uploads: 0, holds: 0 };
  function stream(u, ahead = 0) {
    // look further ahead while the camera is still travelling toward the scroll position
    const look = (mobile ? 14 : 22) + Math.min(20, ahead);
    for (const id of Object.keys(USE)) {
      if (PL[id].dyn) continue;
      if (rangesNear(id, u, 4 + Math.min(20, ahead), look)) ensure(id);
    }
    upload(u);
    const live = Object.keys(tex).filter((k) => tex[k] && PL[k] && !PL[k].dyn);
    if (live.length > BUDGET) {
      live.sort((a, b) => distTo(b, u) - distTo(a, u));
      for (const id of live.slice(0, live.length - BUDGET)) {
        if (rangesNear(id, u, 4, 14)) continue;
        gl.deleteTexture(tex[id]); delete tex[id]; forget(PL[id].src);
      }
    }
  }

  // dynamic plates: one texture each, re-uploaded when the frame changes
  const dyn = {
    TT: { n: meta.tt_frames, prefix: 'tt_', cur: -1, t: null, frames: [] },
    DRP: { n: meta.drp ? meta.drp.frames : 0, prefix: 'drp_', cur: -1, t: null, frames: [] },
  };
  function dynFrame(id, i) {
    const d = dyn[id]; if (!d.n) return black;
    i = clamp(Math.round(i), 0, d.n - 1);
    // nearest loaded frame, loading as we go
    let k = -1;
    for (let r = 0; r < d.n; r++) {
      for (const j of [i + r, i - r]) {
        if (j < 0 || j >= d.n) continue;
        if (!d.frames[j]) { d.frames[j] = 'loading'; loadFrame(d.prefix + String(j).padStart(2, '0')).then((im) => (d.frames[j] = im)); }
        if (d.frames[j] && d.frames[j] !== 'loading' && k < 0) k = j;
      }
      if (k >= 0) break;
    }
    if (k < 0) return d.t || black;
    if (k !== d.cur) {
      if (!d.t) d.t = makeTex(d.frames[k], false);
      else { gl.bindTexture(gl.TEXTURE_2D, d.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, d.frames[k]); }
      d.cur = k;
    }
    return d.t;
  }
  function preloadDyn(id, from, to) { const d = dyn[id]; for (let j = from; j <= to; j++) if (j >= 0 && j < d.n && !d.frames[j]) { d.frames[j] = 'loading'; loadFrame(d.prefix + String(j).padStart(2, '0')).then((im) => (d.frames[j] = im)); } }

  // first scene first
  const firstReady = (async () => {
    await ensure('A'); upload(0); onProgressLoad?.(0.5);
    await Promise.all(['B', 'C'].map(ensure)); upload(0); upload(0); onProgressLoad?.(1);
    tex.M = makeTex(await loadImage('f_mask'));
  })();

  // ---------- geometry ----------
  let W = 1, H = 1, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.75);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  const pt = (pl, u, v) => (pl.crop ? [(u - pl.crop.mx0) / pl.crop.mcw, v] : pl.ext ? [u, pl.ext.y0 + v * pl.ext.sy] : [u, v]);
  function cover(pl, zoom, c) {
    const ta = pl.w / pl.h, sa = W / H;
    let fw, fh;
    if (sa > ta) { fw = 1; fh = ta / sa; } else { fh = 1; fw = sa / ta; }
    fw /= zoom; fh /= zoom;
    const cc = pt(pl, c[0], c[1]);
    if (pl.free) return [fw, fh, cc[0] - fw / 2, cc[1] - fh / 2];
    return [fw, fh, clamp(cc[0] - fw / 2, 0, Math.max(0, 1 - fw)), clamp(cc[1] - fh / 2, 0, Math.max(0, 1 - fh))];
  }
  const toScreen = (X, pl, p) => { const q = pt(pl, p[0], p[1]); return [(q[0] - X[2]) / X[0], (q[1] - X[3]) / X[1]]; };
  // zoom at which the whole bottle (turntable) fits the screen
  function ttFit() {
    const sa = W / H; const fh = sa > 1 ? 1 / sa : 1, fw = sa > 1 ? 1 : sa;
    return Math.min(fh / (mobile ? 1.02 : 0.94), fw / (mobile ? 0.66 : 0.6));
  }
  // centre for the turntable so the bottle sits at screen x = sx
  const ttAt = (sx, z) => { const fw = (W / H > 1 ? 1 : W / H) / z; return [0.5 - (sx - 0.5) * fw, 0.53]; };
  // zoom/centre on the bog plate so its bottle matches the turntable bottle on screen
  function fMatch(sx, zTT) {
    // turntable bottle: cap top 0.09 → base 0.86 of the frame (centre 0.475); bog bottle: 0.072 → 0.42 of the photo
    const sa = W / H;
    const fhTT = (sa > 1 ? 1 / sa : 1) / zTT, fwTT = (sa > 1 ? 1 : sa) / zTT;
    const cTT = ttAt(sx, zTT);
    const syScreen = (0.475 - (cTT[1] - fhTT / 2)) / fhTT;
    const screenH = 0.77 / fhTT;
    const pl = PL.F, ta = pl.w / pl.h, ey = pl.ext.sy;
    const fh0 = sa > ta ? ta / sa : 1, fw0 = sa > ta ? 1 : sa / ta;
    const z = Math.max(1, screenH * fh0 / (0.348 * ey));
    const fhF = fh0 / z, fwF = fw0 / z;
    const bc = [0.498, 0.246];
    return { z, c: [bc[0] - (sx - 0.5) * fwF, bc[1] - (syScreen - 0.5) * fhF / ey] };
  }

  // ---------- lens ----------
  function lensFrom(L0, drop, t, fmin) {
    const asp = W / H, Rcover = Math.hypot(asp / 2, 0.5) * 1.06;
    return {
      mode: 1, mix: sm(seg(t, 0.02, 0.16)), k: 1 - sm(seg(t, 0.5, 1)),
      _lens: (X0) => {
        const s0 = toScreen(X0, L0.pl, drop);
        const R = lerp(drop[2] / X0[1], Rcover, Math.pow(t, 2.4));
        const c = lerp2(s0, [0.5, 0.5], sm(seg(t, 0.25, 1)));
        const F = 0.5 * (R + fmin + Math.sqrt((R - fmin) ** 2 + 0.004));
        return [c[0], c[1], R, F];
      },
    };
  }

  const drag = { v: 0 };
  // ---------- the shot list ----------
  // Rhythm: FAST transitions (3–5u), MEDIUM camera moves (5–7u), SLOW product holds (8u+). 1u ≈ 10vh of scroll.
  function compose(u, time, intro) {
    const S = { mode: 0, mix: 0, k: 0, wipe: 0, lens: [0.5, 0.5, 0, 1], expo: 1, fade: 0, vig: 0.42, mist: 0, warm: 0, amber: 0, fadeCol: INK, ttA: null, drpT: null };
    let L0, L1 = null;
    const zf = ttFit();

    if (u < 9) {                                   // 01 ENTER — a dark blurred shape comes into focus; the camera leans in
      const e = ioc(seg(u, 0, 9));
      L0 = L(PL.A, 1.06 + 1.32 * e, lerp2(PL.A.f, P.dropA, e));
    } else if (u < 14) {                           // lens: the drop holds a birch leaf
      const t = seg(u, 9, 14);
      L0 = L(PL.A, 2.38 + 2.2 * ic(t), P.dropA);
      L1 = L(PL.B, 1 + 0.22 * (1 - sm(t)), PL.B.f);
      Object.assign(S, lensFrom(L0, P.dropA, t, 0.6));
    } else if (u < 19) {                           // 02 THE SOURCE — across the leaf toward one droplet
      const e = ioc(seg(u, 14, 19));
      L0 = L(PL.B, 1 + 0.95 * e, lerp2([0.52, 0.48], P.dropB, e));
    } else if (u < 23) {                           // lens: the droplet holds heather
      const t = seg(u, 19, 23);
      L0 = L(PL.B, 1.95 + 2.6 * ic(t), P.dropB);
      L1 = L(PL.C, 1 + 0.2 * (1 - sm(t)), PL.C.f);
      Object.assign(S, lensFrom(L0, P.dropB, t, 0.55));
      S.warm = 0.35 * sm(t);
    } else if (u < 30.5) {                         // heather; a birch twig brushes the lens
      const e = seg(u, 23, 30.5);
      const push = ic(seg(u, 27, 29.6));
      L0 = L(PL.C, 1 + 0.32 * seg(u, 23, 27) + 1.6 * push, [lerp(0.52, 0.62, e), 0.5], 0, 0.32 * push);
      S.warm = 0.35; S.expo = 1 + 0.12 * bump(u, 27.5, 29.1, 30.5);
      if (u > 28.2) {
        const s = oc(seg(u, 28.9, 30.5));
        L1 = L(PL.D, lerp(1.9, 1.32, s), P.berry, 0, 0.3 * (1 - s));
        S.mix = sm(seg(u, 28.7, 29.6)); S.warm = lerp(0.35, 0.2, S.mix);
      }
    } else if (u < 35) {                           // 03 THE INGREDIENT — cloudberry, camera eases back
      const e = oc(seg(u, 30.5, 35));
      L0 = L(PL.D, 1.32 - 0.3 * e, lerp2(P.berry, PL.D.f, e));
      S.warm = 0.2;
    } else if (u < 39) {                           // rack focus out: berry → the whole bog
      const t = seg(u, 35, 39);
      L0 = L(PL.D, 1.02 + 0.05 * t, PL.D.f, 0.03 * sm(seg(t, 0, 0.6)));
      L1 = L(PL.E, 1.7 - 0.7 * oc(t), [mobile ? 0.22 : 0.5, 0.46], 0.02 * (1 - sm(seg(t, 0.25, 0.8))), 0.16 * (1 - sm(seg(t, 0.35, 1))));
      S.mix = sm(seg(t, 0.12, 0.7)); S.mist = S.mix;
    } else if (u < 58) {                           // 04 MEET THE PRODUCT — through the heather; it grows from the moss
      const panX = mobile ? lerp(0.22, P.bottle[0], ioc(seg(u, 38, 45.5))) : 0.5;
      const push = ioc(seg(u, 44.5, 47.5)), settle = oc(seg(u, 47.5, 53));
      const z = 1 + 0.04 * seg(u, 39, 44.5) + 0.58 * push - 0.24 * settle + 0.03 * seg(u, 53, 58);
      const c = [panX, lerp(0.46, 0.31, ioc(seg(u, 44.5, 53)))];
      const mb = 0.07 * bump(u, 44.3, 46, 48);
      L0 = L(PL.E, z, c, 0, mb, [0.5, 0.42]); L1 = L(PL.F, z, c);
      S.mode = 2; S.wipe = sm(seg(u, 47, 50.4)); S.mix = sm(seg(u, 50, 51.2));
      S.mist = 1 - 0.5 * S.mix; S.expo = 1 + 0.22 * bump(u, 47.6, 49.8, 53); S.warm = 0.15 * S.mix;
    } else if (u < 62.5) {                         // 05 INSIDE THE PRODUCT — into the glass until amber is all there is
      const t = seg(u, 58, 62.5), e = ic(t);
      L0 = L(PL.F, lerp(1.37, 9, e), lerp2([mobile ? P.bottle[0] : 0.5, 0.31], P.oilF, sm(seg(t, 0, 0.5))), 0.02 * sm(seg(t, 0.55, 1)), 0.3 * ic(t));
      S.expo = 1 + 0.12 * t; S.warm = 0.15 + 0.25 * t; S.vig = lerp(0.42, 0.8, t);
      if (t > 0.72) { L1 = L(PL.MAC, 3.6, P.macOil, 0.02, 0.22); S.mix = sm(seg(t, 0.75, 1)); }
    } else if (u < 70) {                           // the glass, the oil, the frosted name — pulling back
      const e = oc(seg(u, 62.5, 69));
      L0 = L(PL.MAC, lerp(3.6, 1.14, e), lerp2(P.macOil, [0.56, 0.6], e), 0.02 * (1 - sm(seg(u, 62.5, 64.5))), 0.22 * (1 - sm(seg(u, 62.5, 64.8))));
      S.vig = lerp(0.8, 0.5, e); S.warm = lerp(0.4, 0.1, e); S.fadeCol = STUDIO;
    } else if (u < 75) {                           // follow the pipette down — match cut on its tip
      const t = seg(u, 70, 75);
      const tilt = 0.07 * bump(t, 0.15, 0.5, 0.85);
      L0 = L(PL.MAC, lerp(1.14, 2.6, ioc(seg(t, 0, 0.6))), lerp2([0.56, 0.6], P.macPip, ioc(seg(t, 0, 0.6))), 0, 0, null, [0, tilt]);
      L1 = L(PL.DRP, lerp(2.5, 1.02, oc(seg(t, 0.45, 1))), lerp2(P.drpTip, PL.DRP.f, oc(seg(t, 0.45, 1))), 0, 0, null, [0, tilt]);
      S.mix = sm(seg(t, 0.42, 0.6)); S.drpT = 0; S.vig = 0.5;
    } else if (u < 86) {                           // 06 THREE DROPS
      const t = seg(u, 75, 86);
      L0 = L(PL.DRP, 1.02 + 0.06 * t, PL.DRP.f);
      S.drpT = t; S.vig = 0.55;
    } else if (u < 90) {                           // dive into the pool: its surface becomes the oil inside the bottle
      const t = seg(u, 86, 90);
      L0 = L(PL.DRP, lerp(1.08, 6, ic(seg(t, 0, 0.8))), lerp2(PL.DRP.f, P.drpPool, sm(seg(t, 0, 0.5))), 0.02 * sm(seg(t, 0.45, 0.85)), 0.3 * ic(seg(t, 0, 0.85)));
      S.drpT = 1;
      L1 = L(PL.TT, 7, P.ttOil, 0.02, 0.25); S.mix = sm(seg(t, 0.72, 1)); S.ttA = 0; S.warm = 0.25 * t;
      S.fadeCol = STUDIO;
    } else if (u < 95.5) {                         // pull back: the bottle is revealed around the oil
      const t = seg(u, 90, 95.5), e = oc(t);
      L0 = L(PL.TT, lerp(7, zf, e), lerp2(P.ttOil, ttAt(0.5, zf), e), 0.02 * (1 - sm(seg(t, 0, 0.3))), 0.25 * (1 - sm(seg(t, 0, 0.5))));
      S.ttA = 0; S.warm = 0.25 * (1 - e);
    } else if (u < 101.5) {                        // the bottle turns
      const t = seg(u, 95.5, 101.5);
      L0 = L(PL.TT, zf, ttAt(0.5, zf));
      S.ttA = t < 0.33 ? Math.sin(t / 0.33 * Math.PI / 2) : t < 0.8 ? Math.cos((t - 0.33) / 0.47 * Math.PI) : -1 + seg(t, 0.8, 1);
    } else if (u < 106) {                          // 07 RETURN TO NATURE — closer, into the amber, until it is sunlight
      const t = seg(u, 101.5, 106), e = ic(t);
      L0 = L(PL.TT, lerp(zf, 6.5, e), lerp2(ttAt(0.5, zf), P.ttOil, sm(seg(t, 0, 0.6))), 0.02 * sm(seg(t, 0.55, 1)), 0.26 * e);
      S.ttA = 0; S.amber = sm(seg(t, 0.45, 1)); S.warm = 0.3 * t;
      if (t > 0.66) { L1 = L(PL.IC, 1.6, P.icLight, 0.02, 0.2); S.mix = sm(seg(t, 0.7, 1)); }
    } else if (u < 113.5) {                        // the light settles: we are standing in front of the cloudberries
      const t = seg(u, 106, 113.5), e = ioc(seg(t, 0, 0.75));
      L0 = L(PL.IC, lerp(1.6, 1.15, e), lerp2(P.icLight, P.icBerry, e), 0.02 * (1 - sm(seg(t, 0, 0.3))), 0.2 * (1 - sm(seg(t, 0, 0.4))));
      S.amber = 1 - sm(seg(t, 0, 0.42)); S.warm = 0.3;
    } else if (u < 117) {                          // 08 THE INGREDIENTS — tilt down into the moss under the berries
      const t = seg(u, 113.5, 117);
      const tilt = 0.09 * bump(t, 0.1, 0.62, 1);
      L0 = L(PL.IC, lerp(1.15, 2.4, ic(t)), lerp2(P.icBerry, P.icMoss, ioc(t)), 0, 0.12 * ic(t), null, [0, tilt]);
      L1 = L(PL.IM, 2.6, P.imMoss, 0, 0.1 * (1 - t), null, [0, tilt]); S.mix = sm(seg(t, 0.55, 0.85));
      S.warm = 0.3 * (1 - S.mix);
    } else if (u < 124) {                          // through the moss: fibres, water, light
      const t = seg(u, 117, 124), e = oc(t);
      L0 = L(PL.IM, lerp(2.6, 1.12, e), lerp2(P.imMoss, [0.5, 0.52], e), 0, 0.1 * (1 - sm(seg(t, 0, 0.25))));
    } else if (u < 128) {                          // the focus slips to the mist behind; birch trunks appear in it
      const t = seg(u, 124, 128);
      L0 = L(PL.IM, lerp(1.12, 1.5, sm(t)), lerp2([0.5, 0.52], P.imMist, ioc(seg(t, 0, 0.7))), 0.02 * sm(seg(t, 0.2, 0.6)));
      L1 = L(PL.IB, 1.45, mobile ? P.ibBark : P.ibMist, 0.012); S.mix = sm(seg(t, 0.42, 0.68)); S.mist = 0.6;
      S.fog = 0.74 * bump(u, 124.2, 126.1, 129.4); S.fogTop = -0.15;
    } else if (u < 133) {                          // out of the mist onto the bark; a bead of sap
      const t = seg(u, 128, 133), e = ioc(t);
      L0 = L(PL.IB, lerp(1.45, 2.05, e), lerp2(mobile ? P.ibBark : P.ibMist, P.sap, e), 0.012 * (1 - sm(seg(t, 0, 0.3))));
      S.mist = 0.6 * (1 - t); S.fog = 0.74 * bump(u, 124.2, 126.1, 129.4); S.fogTop = -0.15;
    } else if (u < 137) {                          // lens: the sap holds the heather
      const t = seg(u, 133, 137);
      L0 = L(PL.IB, 2.05 + 3 * ic(t), P.sap);
      L1 = L(PL.IH, 1 + 0.2 * (1 - sm(t)), P.ihBee);
      Object.assign(S, lensFrom(L0, P.sap, t, 0.55));
    } else if (u < 143) {                          // heather, the bee, pollen in the light
      const t = seg(u, 137, 143);
      L0 = L(PL.IH, lerp(1.2, 1.05, oc(t)), lerp2(P.ihBee, [0.45, 0.48], t));
      S.mist = 0.5; S.warm = 0.2;
    } else if (u < 151) {                          // 09 THE FORMULA — the world draws back into the dark; four plants converge
      const t = seg(u, 143, 151);
      L0 = L(PL.IH, lerp(1.05, 1.4, sm(seg(t, 0, 0.5))), [0.45, 0.48], 0.04 * sm(seg(t, 0, 0.35)));
      S.fade = sm(seg(t, 0.05, 0.4)); S.fadeCol = STUDIO;
      if (t > 0.7) { L1 = L(PL.TT, lerp(zf * 1.3, zf, oc(seg(t, 0.7, 1))), ttAt(mobile ? 0.5 : 0.64, zf)); S.mix = 1; S.ttA = 0; S.fade = lerp(S.fade, 0, sm(seg(t, 0.72, 0.95))); S.expo = 1 + 0.5 * bump(t, 0.7, 0.76, 0.95); }
    } else if (u < 168) {                          // formula, then 10 THE RITUAL beside the bottle
      const t = seg(u, 151, 168);
      L0 = L(PL.TT, zf, ttAt(mobile ? 0.5 : lerp(0.64, 0.66, t), zf));
      if (mobile) {                                // on a phone the bottle steps up and back to make room for the panel
        const r = sm(seg(u, 151, 152.6)) * (1 - sm(seg(u, 166.4, 168)));
        L0 = L(PL.TT, lerp(zf, zf * 0.56, r), lerp2(ttAt(0.5, zf), [0.5, 1.2], r));
      }
      S.ttA = Math.sin(t * Math.PI * 2) * 0.35;
    } else if (u < 172) {                          // 11 SHOP — the bog grows back around the bottle (matched size and place)
      const t = seg(u, 168, 172);
      const sx = mobile ? 0.5 : 0.66;
      L0 = L(PL.TT, zf, ttAt(sx, zf)); S.ttA = 0;
      const m = fMatch(sx, zf);
      const zShop = mobile ? 1.02 : 1.22, cShop = mobile ? [P.bottle[0], 0.3] : [P.bottle[0] - 0.2, 0.33];
      L1 = L(PL.F, lerp(m.z, zShop, oc(seg(t, 0.35, 1))), lerp2(m.c, cShop, oc(seg(t, 0.35, 1))));
      S.mix = sm(seg(t, 0.05, 0.45)); S.mist = S.mix; S.fog = 0.55 * bump(t, 0, 0.3, 0.75);
    } else if (u < 186) {                          // the shop holds in the landscape
      const t = seg(u, 172, 186);
      L0 = L(PL.F, (mobile ? 1.02 : 1.22) - (mobile ? 0.02 : 0.04) * t, mobile ? [P.bottle[0], 0.3] : [P.bottle[0] - 0.2, 0.33]);
      S.mist = 1;
    } else {                                       // 12 RETURN TO NATURE — moss closes over the bottle; it is gone; the bog opens up
      const t = seg(u, 186, U_MAX);
      const zs = mobile ? 1.0 : 1.18;
      const c0 = mobile ? [P.bottle[0], 0.3] : [P.bottle[0] - 0.2, 0.33];
      const pull = ioc(seg(u, 189, 196));
      const z = lerp(zs, 1, pull), c = lerp2(c0, [0.5, 0.46], pull);
      L0 = L(PL.F, z, c);
      if (u > 188.6 && u <= 192) { L1 = L(PL.E, z, c); S.mix = sm(seg(u, 188.7, 190.1)); }
      if (u > 190.1) L0 = L(PL.E, z, c);
      if (u > 192) { L1 = L(PL.FIN, lerp(1.5, 1.0, oc(seg(u, 192, U_MAX))), [0.5, 0.5], 0.0016); S.mix = sm(seg(u, 192.4, 196)); }
      S.mist = 1 - S.mix * 0.6;
      S.fog = bump(u, 186.2, 189.2, 193.8); S.fogTop = mobile ? 0.12 : 0.16;
    }

    if (S.ttA !== null) S.ttA = clamp(S.ttA + drag.v, -1, 1);
    S.fade = Math.max(S.fade, 1 - oc(intro));
    S.L0 = L0; S.L1 = L1;
    return S;
  }

  // ---------- render ----------
  let last = null;
  // the camera is never perfectly still: a slow, small breath (screen-space, applied to both layers alike,
  // so matched cuts stay matched). It is what keeps a paused frame alive.
  function breathe(X, time) {
    const a = 0.007 + 0.005 * Math.sin(time * 0.27);
    const s = 1 / (1 + a), room = (1 - s) / 2 * 0.65;
    const px = room * Math.sin(time * 0.19), py = room * Math.cos(time * 0.23);
    return [X[0] * s, X[1] * s, X[2] + X[0] * ((1 - s) / 2 + px), X[3] + X[1] * ((1 - s) / 2 + py)];
  }
  function render(u, time, intro, opt = {}) {
    const motion = opt.motion ?? 1;
    stream(u, opt.ahead || 0);
    const S = compose(u, time, intro);
    const bind = (unit, Lr, which) => {
      if (!Lr) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, black); return null; }
      let t;
      if (Lr.pl.id === 'TT') {
        const d = dyn.TT, a = clamp(S.ttA ?? 0, -1, 1), FRONT = meta.tt_center;
        t = dynFrame('TT', a >= 0 ? FRONT + a * (d.n - 1 - FRONT) : FRONT + a * FRONT);
      } else if (Lr.pl.id === 'DRP') {
        // scroll → footage time, piecewise so each of the three drops gets the same amount of scroll
        const K = meta.drp.keys, x = clamp(S.drpT ?? 0);
        let f = K[K.length - 1][1];
        for (let i = 1; i < K.length; i++) if (x <= K[i][0]) { f = lerp(K[i - 1][1], K[i][1], (x - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); break; }
        t = dynFrame('DRP', f);
      }
      else t = tex[Lr.pl.id] || black;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      return t;
    };
    const t0 = bind(0, S.L0), t1 = bind(1, S.L1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex.M || black);
    S.X0 = breathe(cover(S.L0.pl, S.L0.z, S.L0.c), time); S.X1 = S.L1 ? breathe(cover(S.L1.pl, S.L1.z, S.L1.c), time) : S.X0;
    // a plate that has not arrived yet: keep the last good frame on screen instead of flashing to black
    if (t0 === black && last && intro >= 1) { stats.holds++; return last; }
    if (S._lens) S.lens = S._lens(S.X0);
    const has1 = S.L1 && t1 && t1 !== black;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform4fv(U.uX0, S.X0); gl.uniform4fv(U.uX1, S.X1);
    gl.uniform2f(U.uE, S.L0.pl.free ? 1 : 0, S.L1 && S.L1.pl.free ? 1 : 0);
    gl.uniform3fv(U.uBg, STUDIO);
    // motion blur only exists while the camera actually moves: stop mid-transition and the frame sharpens
    const mf = (mobile ? 0.65 : 1) * motion;
    const M = (Lr) => (Lr && Lr.zb ? [Lr.zc ? Lr.zc[0] : 0.5, Lr.zc ? Lr.zc[1] : 0.5, Lr.zb * mf, 0] : [0.5, 0.5, 0, 0]);
    const Dv = (Lr) => (Lr && Lr.dir ? [Lr.dir[0] * motion, Lr.dir[1] * motion] : [0, 0]);
    gl.uniform4fv(U.uM0, M(S.L0)); gl.uniform4fv(U.uM1, M(S.L1));
    gl.uniform2fv(U.uD0, Dv(S.L0)); gl.uniform2fv(U.uD1, Dv(S.L1));
    gl.uniform1f(U.uFog, S.fog || 0); gl.uniform1f(U.uFogTop, S.fogTop ?? -0.1);
    gl.uniform1f(U.uB0, S.L0.b || 0); gl.uniform1f(U.uB1, S.L1 ? S.L1.b || 0 : 0);
    gl.uniform1f(U.uMix, has1 ? S.mix : 0);
    gl.uniform1i(U.uMode, has1 ? S.mode : 0);
    gl.uniform1f(U.uK, S.k); gl.uniform1f(U.uWipe, S.wipe);
    gl.uniform4fv(U.uLens, S.lens);
    gl.uniform1f(U.uExpo, S.expo); gl.uniform1f(U.uFade, S.fade); gl.uniform1f(U.uVig, S.vig);
    gl.uniform1f(U.uMist, S.mist); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uWarm, S.warm); gl.uniform1f(U.uAmber, S.amber);
    gl.uniform3fv(U.uFadeCol, S.fadeCol);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // keep upcoming dynamic frames warm
    if (u > 64 && u < 92) preloadDyn('DRP', 0, dyn.DRP.n - 1);
    if (u > 80 && u < 175) preloadDyn('TT', 0, dyn.TT.n - 1);
    last = S;
    return S;
  }
  // screen position of a plate point in the current frame (for pinned labels)
  function project(S, plId, p) {
    if (S.L0.pl.id === plId) return toScreen(S.X0, S.L0.pl, p);
    if (S.L1 && S.L1.pl.id === plId) return toScreen(S.X1, S.L1.pl, p);
    return null;
  }
  return { render, resize, firstReady, mobile, project, drag, P, stats, get size() { return { W, H }; } };
}
