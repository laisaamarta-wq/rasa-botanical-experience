// Shop: product options, slide-in bag, and a three-step demo checkout.
import { A } from './assets.js';
import { getPaymentProvider } from './payments.js';

const PRODUCT = { id: 'first-light', name: 'First Light', kind: 'Botanical face oil', img: 'product_sm' };
const SIZES = { 30: { label: '30 ml', price: 84 }, 50: { label: '50 ml', price: 118 } };
const FREE_SHIP = 120;
const SHIPPING = { standard: { label: 'Standard', note: '2–4 working days', price: 6 }, express: { label: 'Express', note: 'Next working day', price: 14 } };
const eur = (n) => '€' + (Number.isInteger(n) ? n : n.toFixed(2));
const $ = (s, r = document) => r.querySelector(s);

let cart = [];
try { cart = JSON.parse(localStorage.getItem('rasa-cart') || '[]'); } catch { cart = []; }
const save = () => { try { localStorage.setItem('rasa-cart', JSON.stringify(cart)); } catch {} };

export function initShop() {
  const drawer = $('#drawer'), scrim = $('#scrim'), body = $('#cartBody'), foot = $('#cartFoot');
  let size = '30', qty = 1;

  // ---- product block ----
  const qtyOut = $('#qty'), addPrice = $('#addPrice');
  const syncAdd = () => { qtyOut.textContent = qty; addPrice.textContent = eur(SIZES[size].price * qty); };
  document.querySelectorAll('input[name="size"]').forEach((r) => r.addEventListener('change', () => { size = r.value; syncAdd(); }));
  document.querySelectorAll('.buyrow .qty button').forEach((b) => b.addEventListener('click', () => { qty = Math.max(1, Math.min(9, qty + +b.dataset.q)); syncAdd(); }));
  $('#addBtn').addEventListener('click', () => { add(size, qty); qty = 1; syncAdd(); open(); });

  // ---- bag ----
  function add(sz, q) {
    const line = cart.find((l) => l.size === sz);
    if (line) line.qty = Math.min(9, line.qty + q); else cart.push({ id: PRODUCT.id, size: sz, qty: q });
    save(); render(); bump();
  }
  const count = () => cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = () => cart.reduce((s, l) => s + SIZES[l.size].price * l.qty, 0);
  function bump() { const c = $('#bagCount'); c.textContent = count(); c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 400); }

  function render() {
    $('#bagCount').textContent = count();
    if (!cart.length) {
      body.innerHTML = `<div class="empty"><p>Your bag is empty.</p>Three drops are waiting.</div>`;
      foot.innerHTML = `<button class="btn btn--light" data-close data-go="176">Discover First Light</button>`;
      return;
    }
    body.innerHTML = cart.map((l, i) => `
      <div class="line">
        <img src="${A[PRODUCT.img]}" alt="" />
        <div>
          <p class="line__name">${PRODUCT.name}</p>
          <p class="line__meta">${PRODUCT.kind} · ${SIZES[l.size].label}</p>
          <div class="qty" aria-label="Quantity"><button data-i="${i}" data-d="-1" aria-label="Decrease">−</button><output>${l.qty}</output><button data-i="${i}" data-d="1" aria-label="Increase">+</button></div>
          <button class="line__rm" data-rm="${i}">Remove</button>
        </div>
        <span class="line__price">${eur(SIZES[l.size].price * l.qty)}</span>
      </div>`).join('');
    const st = subtotal(), left = Math.max(0, FREE_SHIP - st);
    foot.innerHTML = `
      <div class="meter"><i style="transform:scaleX(${Math.min(1, st / FREE_SHIP)})"></i></div>
      <p class="meter-note">${left ? `${eur(left)} away from free delivery` : 'Delivery is on us'}</p>
      <p class="sum"><span>Subtotal</span><span>${eur(st)}</span></p>
      <p class="sum"><span>Delivery</span><span>${left ? 'From €6' : 'Free'}</span></p>
      <p class="sum sum--total"><span>Total</span><span>${eur(st)}</span></p>
      <button class="btn btn--amber" id="toCheckout">Checkout</button>
      <p class="fine" style="text-align:center">Demo store · no payment is taken</p>`;
  }
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rm) { cart.splice(+b.dataset.rm, 1); }
    else if (b.dataset.d) { const l = cart[+b.dataset.i]; l.qty += +b.dataset.d; if (l.qty < 1) cart.splice(+b.dataset.i, 1); if (l.qty > 9) l.qty = 9; }
    save(); render();
  });
  foot.addEventListener('click', (e) => {
    if (e.target.closest('#toCheckout')) { close(); setTimeout(() => checkout.open(), 350); }
    const c = e.target.closest('[data-close]'); if (c) { close(); if (c.dataset.go) window.__rasa?.goTo(+c.dataset.go); }
  });

  function open() { scrim.hidden = false; requestAnimationFrame(() => { scrim.classList.add('is-on'); drawer.classList.add('is-on'); }); drawer.setAttribute('aria-hidden', 'false'); setTimeout(() => $('#drawerClose').focus(), 300); }
  function close() { scrim.classList.remove('is-on'); drawer.classList.remove('is-on'); drawer.setAttribute('aria-hidden', 'true'); setTimeout(() => (scrim.hidden = true), 600); }
  $('#bagBtn').addEventListener('click', open);
  $('#drawerClose').addEventListener('click', close);
  scrim.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); checkout.close(); } });
  render();

  // ---- checkout ----
  const checkout = createCheckout({ getCart: () => cart, subtotal, clear: () => { cart = []; save(); render(); } });
}

function createCheckout({ getCart, subtotal, clear }) {
  const modal = $('#checkout'), bodyEl = $('#coBody'), steps = [...document.querySelectorAll('#coSteps li')];
  const provider = getPaymentProvider('demo');
  let step = 0;
  const data = { email: '', first: '', last: '', address: '', city: '', postcode: '', country: 'Latvia', ship: 'standard' };

  const setStep = (i) => { step = i; steps.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-done', k < i); }); draw(); };
  const shipCost = () => (data.ship === 'standard' && subtotal() >= FREE_SHIP ? 0 : SHIPPING[data.ship].price);
  const total = () => subtotal() + shipCost();

  function field(name, label, type = 'text', cls = '', auto = '') {
    return `<div class="field ${cls}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(data[name])}" autocomplete="${auto}" /><div class="err"></div></div>`;
  }
  function draw() {
    if (step === 0) {
      bodyEl.innerHTML = `<h3>Where should it go?</h3>
        <form class="form" id="coForm" novalidate>
          ${field('email', 'Email', 'email', 'full', 'email')}
          ${field('first', 'First name', 'text', '', 'given-name')}
          ${field('last', 'Last name', 'text', '', 'family-name')}
          ${field('address', 'Address', 'text', 'full', 'street-address')}
          ${field('city', 'City', 'text', '', 'address-level2')}
          ${field('postcode', 'Postcode', 'text', '', 'postal-code')}
          <div class="field full"><label for="f-country">Country</label><select id="f-country" name="country">
            ${['Latvia', 'Lithuania', 'Estonia', 'Finland', 'Sweden', 'Germany', 'France', 'Netherlands', 'Other EU'].map((c) => `<option ${c === data.country ? 'selected' : ''}>${c}</option>`).join('')}
          </select></div>
        </form>
        <div class="co-actions"><button class="link" data-x>Back to bag</button><button class="btn btn--light" data-next>Continue to delivery</button></div>`;
    } else if (step === 1) {
      bodyEl.innerHTML = `<h3>How fast?</h3>
        <div class="opts">${Object.entries(SHIPPING).map(([k, s]) => `
          <label class="opt"><span><input type="radio" name="ship" value="${k}" ${data.ship === k ? 'checked' : ''}/>${s.label}<small>${s.note}</small></span><span>${subtotal() >= FREE_SHIP && k === 'standard' ? 'Free' : eur(s.price)}</span></label>`).join('')}
        </div>
        <div class="co-actions"><button class="link" data-back>Back</button><button class="btn btn--light" data-next>Review order</button></div>`;
    } else if (step === 2) {
      const lines = getCart().map((l) => `<div class="r"><dt>First Light · ${SIZES[l.size].label} × ${l.qty}</dt><dd>${eur(SIZES[l.size].price * l.qty)}</dd></div>`).join('');
      bodyEl.innerHTML = `<h3>One last look.</h3>
        <div class="review"><dl>${lines}
          <div class="r"><dt>Delivery · ${SHIPPING[data.ship].label}</dt><dd>${shipCost() ? eur(shipCost()) : 'Free'}</dd></div>
          <div class="r"><dt><b>Total</b></dt><dd><b>${eur(total())}</b></dd></div></dl>
          <dl><div class="r"><dt>Send to</dt><dd>${esc(data.first)} ${esc(data.last)}<br>${esc(data.address)}, ${esc(data.city)} ${esc(data.postcode)}<br>${esc(data.country)}</dd></div>
          <div class="r"><dt>Email</dt><dd>${esc(data.email)}</dd></div>
          <div class="r"><dt>Payment</dt><dd>Demo mode, nothing is charged</dd></div></dl></div>
        <div class="co-actions"><button class="link" data-back>Back</button><button class="btn btn--amber" data-place>Place demo order · ${eur(total())}</button></div>`;
    }
  }
  bodyEl.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-x')) { close(); document.getElementById('bagBtn').click(); }
    if (t.hasAttribute('data-back')) setStep(step - 1);
    if (t.hasAttribute('data-next')) {
      if (step === 0 && !validate()) return;
      if (step === 1) data.ship = bodyEl.querySelector('input[name="ship"]:checked').value;
      setStep(step + 1);
    }
    if (t.hasAttribute('data-place')) {
      t.disabled = true; t.innerHTML = '<span class="spin"></span> Placing order';
      const intent = await provider.createIntent({ items: getCart(), total: total(), customer: data });
      const res = await provider.confirm(intent, data);
      if (res.status === 'succeeded') done(res.reference);
    }
  });
  bodyEl.addEventListener('input', (e) => { if (e.target.name) { data[e.target.name] = e.target.value; e.target.closest('.field')?.classList.remove('bad'); } });

  function validate() {
    const rules = {
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email',
      first: (v) => !!v.trim() || 'Required', last: (v) => !!v.trim() || 'Required',
      address: (v) => v.trim().length > 3 || 'Enter a street address',
      city: (v) => !!v.trim() || 'Required', postcode: (v) => /^[A-Za-z0-9\- ]{3,10}$/.test(v.trim()) || 'Check the postcode',
    };
    let ok = true, first = null;
    for (const [k, fn] of Object.entries(rules)) {
      const el = bodyEl.querySelector(`[name="${k}"]`); data[k] = el.value;
      const r = fn(el.value); const f = el.closest('.field');
      f.classList.toggle('bad', r !== true); f.querySelector('.err').textContent = r === true ? '' : r;
      if (r !== true) { ok = false; first ||= el; }
    }
    data.country = bodyEl.querySelector('[name="country"]').value;
    first?.focus();
    return ok;
  }
  function done(ref) {
    steps.forEach((s) => { s.classList.remove('is-on'); s.classList.add('is-done'); });
    bodyEl.innerHTML = `<div class="done"><div class="drop"></div><h3>Thank you, ${esc(data.first)}.</h3>
      <p class="body" style="margin:0 auto 18px">This was a demo order, so nothing was charged and nothing will ship. In a live store, First Light would leave the workshop tomorrow morning.</p>
      <p class="ref">Order ${ref}</p>
      <div class="co-actions" style="justify-content:center"><button class="btn btn--light" data-finish>Back to the forest</button></div></div>`;
    clear();
    bodyEl.querySelector('[data-finish]').addEventListener('click', () => { close(); window.__rasa?.goTo(199.6); });
  }
  function open() { if (!getCart().length) return; modal.hidden = false; setStep(0); setTimeout(() => bodyEl.querySelector('input')?.focus(), 400); }
  function close() { modal.hidden = true; }
  $('#coClose').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  return { open, close };
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
