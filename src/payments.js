// Payment adapter. The checkout UI only talks to this interface, so a real provider
// (Stripe Payment Element, Adyen, Paddle…) can be dropped in later without touching the UI.
//
//   provider.createIntent(order)          → { id, amount, currency, clientSecret? }
//   provider.confirm(intent, customer)    → { status: 'succeeded' | 'failed', reference }
//
// Only the demo provider exists for now: it takes no payment and never leaves the browser.

const demo = {
  name: 'demo',
  async createIntent(order) {
    await wait(350);
    return { id: 'pi_demo_' + Math.random().toString(36).slice(2, 10), amount: order.total, currency: 'EUR' };
  },
  async confirm(intent) {
    await wait(1100);
    return { status: 'succeeded', reference: 'RASA-' + Math.random().toString(36).slice(2, 7).toUpperCase() };
  },
};

// Example shape for later:
// const stripe = { name: 'stripe', async createIntent(order) { /* POST /api/payment-intents */ }, async confirm(intent, customer) { /* stripe.confirmPayment */ } };

const providers = { demo };
export const getPaymentProvider = (name = 'demo') => providers[name] || demo;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
