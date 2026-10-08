// Gemeinsame Shop-Logik (Stripe-Checkout, Webhook, Bestellabfrage).
// Wird vom lokalen Server (shop/server.js) UND von den Vercel-Funktionen (api/*.js) benutzt.
// Keine externen Abhängigkeiten (Node >= 18).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Preise in Cent – die einzige Quelle der Wahrheit (der Browser schickt nur die Menge).
const PRODUCT = { name: 'Anua Peach 70 Niacin Serum (30 ml)', unitAmount: 2190, image: 'serum-produkt.jpg' };
const MAX_QTY = 10;
const FREE_SHIPPING_FROM = 4000;
const SHIPPING_AMOUNT = 390;
const SHIP_COUNTRIES = ['DE', 'AT', 'CH'];
const SHOP_PATH = '/shop'; // unter dieser Adresse liegt der Shop

// Umgebungsvariablen werden erst beim Aufruf gelesen (wichtig für Tests und .env).
const env = function (k, d) { return process.env[k] || d || ''; };

function loadEnv(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  txt.split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
}

function baseUrl(headers) {
  const pub = env('PUBLIC_URL').replace(/\/+$/, '');
  if (pub) return pub;
  const proto = String(headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return proto + '://' + (headers['x-forwarded-host'] || headers.host);
}

// Stripe erwartet application/x-www-form-urlencoded mit verschachtelten Schlüsseln.
function form(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
}

async function stripe(method, endpoint, params) {
  const api = env('STRIPE_API_BASE', 'https://api.stripe.com').replace(/\/+$/, '');
  const r = await fetch(api + endpoint, {
    method: method,
    headers: Object.assign({ Authorization: 'Bearer ' + env('STRIPE_SECRET_KEY') }, params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    body: params ? form(params) : undefined
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error((data.error && data.error.message) || ('Stripe-Fehler ' + r.status));
  return data;
}

function priceFor(qty) {
  const subtotal = qty * PRODUCT.unitAmount;
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_AMOUNT;
  return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
}

/* Alle drei Funktionen liefern { status, body } */

async function createCheckout(qty, headers) {
  if (!env('STRIPE_SECRET_KEY')) return { status: 503, body: { error: 'Zahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt).' } };
  qty = Number(qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { status: 400, body: { error: 'Ungültige Menge (1–' + MAX_QTY + ').' } };

  const base = baseUrl(headers), p = priceFor(qty);
  const params = {
    mode: 'payment',
    locale: 'de',
    'line_items[0][quantity]': qty,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': PRODUCT.unitAmount,
    'line_items[0][price_data][product_data][name]': PRODUCT.name,
    'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
    'shipping_options[0][shipping_rate_data][display_name]': p.shipping ? 'Standardversand' : 'Gratis-Versand',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]': p.shipping,
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]': 'eur',
    'metadata[qty]': qty,
    success_url: base + SHOP_PATH + '/danke.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: base + SHOP_PATH + '/?abgebrochen=1'
  };
  SHIP_COUNTRIES.forEach(function (c, i) { params['shipping_address_collection[allowed_countries][' + i + ']'] = c; });
  if (base.indexOf('https://') === 0) params['line_items[0][price_data][product_data][images][0]'] = base + SHOP_PATH + '/' + PRODUCT.image;
  try {
    const s = await stripe('POST', '/v1/checkout/sessions', params);
    return { status: 200, body: { url: s.url } };
  } catch (e) {
    console.error('Checkout-Session fehlgeschlagen:', e.message);
    return { status: 502, body: { error: 'Die Zahlung konnte nicht gestartet werden. Bitte versuche es später erneut.' } };
  }
}

function verifySignature(payload, header) {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret || !header) return false;
  const parts = {};
  String(header).split(',').forEach(function (p) {
    const i = p.indexOf('='); if (i < 0) return;
    const k = p.slice(0, i).trim();
    (parts[k] = parts[k] || []).push(p.slice(i + 1).trim());
  });
  const t = parts.t && parts.t[0];
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  return parts.v1.some(function (sig) {
    const a = Buffer.from(sig, 'utf8'), b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function saveOrder(session) {
  const ship = session.shipping_details || (session.collected_information && session.collected_information.shipping_details) || {};
  const order = {
    id: session.id,
    created: new Date().toISOString(),
    paid: session.payment_status === 'paid',
    email: session.customer_details && session.customer_details.email,
    name: ship.name || (session.customer_details && session.customer_details.name),
    address: ship.address,
    qty: Number(session.metadata && session.metadata.qty),
    amount_total: session.amount_total,
    currency: session.currency
  };
  // Auf Vercel ist das Dateisystem schreibgeschützt: Die Bestellung steht in den Funktions-Logs
  // (und immer im Stripe-Dashboard). Lokal/auf eigenem Server: data/orders.jsonl.
  if (env('VERCEL')) { console.log('NEUE BESTELLUNG ' + JSON.stringify(order)); return true; }
  const dir = env('DATA_DIR') || path.join(__dirname, 'data');
  const file = path.join(dir, 'orders.jsonl');
  fs.mkdirSync(dir, { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch (e) { /* noch keine Datei */ }
  if (existing.indexOf('"' + session.id + '"') !== -1) return false; // Stripe liefert Events ggf. mehrfach
  fs.appendFileSync(file, JSON.stringify(order) + '\n');
  console.log('Neue Bestellung:', order.id, order.qty + '×', (order.amount_total / 100).toFixed(2), order.currency);
  return true;
}

function handleWebhook(raw, signature) {
  if (!verifySignature(raw, signature)) return { status: 400, body: 'Ungültige Signatur' };
  let event;
  try { event = JSON.parse(raw); } catch (e) { return { status: 400, body: 'Ungültiges JSON' }; }
  const s = event.data && event.data.object;
  // Bei verzögerten Zahlarten (SEPA, Rechnung) kommt erst "async_payment_succeeded".
  if (s && ((event.type === 'checkout.session.completed' && s.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded')) saveOrder(s);
  return { status: 200, body: { received: true } };
}

async function getOrder(id) {
  id = String(id || '');
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return { status: 400, body: { error: 'Ungültige Sitzung.' } };
  if (!env('STRIPE_SECRET_KEY')) return { status: 503, body: { error: 'Zahlung ist noch nicht eingerichtet.' } };
  try {
    const s = await stripe('GET', '/v1/checkout/sessions/' + id);
    return { status: 200, body: {
      paid: s.payment_status === 'paid',
      pending: s.payment_status === 'unpaid' && s.status === 'complete',
      email: s.customer_details && s.customer_details.email,
      qty: Number(s.metadata && s.metadata.qty),
      amount_total: s.amount_total,
      currency: s.currency
    } };
  } catch (e) { return { status: 404, body: { error: 'Bestellung nicht gefunden.' } }; }
}

module.exports = { loadEnv, createCheckout, handleWebhook, getOrder, verifySignature, priceFor };
