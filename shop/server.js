// Shop-Server ohne externe Abhängigkeiten (Node >= 18).
// - liefert ./public aus
// - POST /api/checkout  -> legt eine Stripe-Checkout-Session an (Preis wird HIER berechnet)
// - POST /api/webhook   -> Stripe-Webhook (Signatur wird geprüft), speichert bezahlte Bestellungen
// - GET  /api/order     -> Daten für die Danke-Seite
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- Konfiguration ---------- */
loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT) || 3000;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const STRIPE_API = (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.jsonl');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Preise in Cent – die einzige Quelle der Wahrheit (der Browser schickt nur die Menge).
const PRODUCT = { name: 'Anua Peach 70 Niacin Serum (30 ml)', unitAmount: 2190, image: 'serum-produkt.jpg' };
const MAX_QTY = 10;
const FREE_SHIPPING_FROM = 4000;
const SHIPPING_AMOUNT = 390;
const SHIP_COUNTRIES = ['DE', 'AT', 'CH'];

function loadEnv(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  txt.split(/\r?\n/).forEach(function (l) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
}

/* ---------- Hilfsfunktionen ---------- */
function send(res, status, body, headers) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store'
  }, headers));
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = []; let size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return proto + '://' + req.headers.host;
}

// Stripe erwartet application/x-www-form-urlencoded mit verschachtelten Schlüsseln.
function form(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
}

async function stripe(method, endpoint, params) {
  const r = await fetch(STRIPE_API + endpoint, {
    method: method,
    headers: Object.assign({ Authorization: 'Bearer ' + STRIPE_KEY }, params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    body: params ? form(params) : undefined
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error((data.error && data.error.message) || ('Stripe-Fehler ' + r.status));
    err.stripe = true; throw err;
  }
  return data;
}

function priceFor(qty) {
  const subtotal = qty * PRODUCT.unitAmount;
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_AMOUNT;
  return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
}

/* ---------- Webhook ---------- */
function verifySignature(payload, header) {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = {};
  String(header).split(',').forEach(function (p) {
    const i = p.indexOf('='); if (i < 0) return;
    (parts[p.slice(0, i).trim()] = parts[p.slice(0, i).trim()] || []).push(p.slice(i + 1).trim());
  });
  const t = parts.t && parts.t[0];
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(t + '.' + payload).digest('hex');
  return parts.v1.some(function (sig) {
    const a = Buffer.from(sig, 'utf8'), b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function saveOrder(session) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(ORDERS_FILE, 'utf8'); } catch (e) { /* noch keine Datei */ }
  if (existing.indexOf('"' + session.id + '"') !== -1) return false; // Stripe liefert Events ggf. mehrfach
  const ship = session.shipping_details || session.collected_information && session.collected_information.shipping_details || {};
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
  fs.appendFileSync(ORDERS_FILE, JSON.stringify(order) + '\n');
  console.log('Neue Bestellung:', order.id, order.qty + '×', (order.amount_total / 100).toFixed(2), order.currency);
  return true;
}

/* ---------- Routen ---------- */
async function api(req, res, url) {
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    if (!STRIPE_KEY) return send(res, 503, { error: 'Zahlung ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt).' });
    let qty;
    try { qty = Number(JSON.parse((await readBody(req, 2048)).toString() || '{}').qty); }
    catch (e) { return send(res, 400, { error: 'Ungültige Anfrage.' }); }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return send(res, 400, { error: 'Ungültige Menge (1–' + MAX_QTY + ').' });

    const base = baseUrl(req), p = priceFor(qty);
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
      success_url: base + '/danke.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: base + '/?abgebrochen=1'
    };
    SHIP_COUNTRIES.forEach(function (c, i) { params['shipping_address_collection[allowed_countries][' + i + ']'] = c; });
    if (base.indexOf('https://') === 0) params['line_items[0][price_data][product_data][images][0]'] = base + '/' + PRODUCT.image;
    try {
      const s = await stripe('POST', '/v1/checkout/sessions', params);
      return send(res, 200, { url: s.url });
    } catch (e) {
      console.error('Checkout-Session fehlgeschlagen:', e.message);
      return send(res, 502, { error: 'Die Zahlung konnte nicht gestartet werden. Bitte versuche es später erneut.' });
    }
  }

  if (url.pathname === '/api/webhook' && req.method === 'POST') {
    const raw = (await readBody(req, 1024 * 1024)).toString('utf8');
    if (!verifySignature(raw, req.headers['stripe-signature'])) return send(res, 400, 'Ungültige Signatur');
    let event;
    try { event = JSON.parse(raw); } catch (e) { return send(res, 400, 'Ungültiges JSON'); }
    const s = event.data && event.data.object;
    // Bei verzögerten Zahlarten (SEPA, Rechnung) kommt erst "async_payment_succeeded".
    if ((event.type === 'checkout.session.completed' && s.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') saveOrder(s);
    return send(res, 200, { received: true });
  }

  if (url.pathname === '/api/order' && req.method === 'GET') {
    const id = url.searchParams.get('session_id') || '';
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return send(res, 400, { error: 'Ungültige Sitzung.' });
    if (!STRIPE_KEY) return send(res, 503, { error: 'Zahlung ist noch nicht eingerichtet.' });
    try {
      const s = await stripe('GET', '/v1/checkout/sessions/' + id);
      return send(res, 200, {
        paid: s.payment_status === 'paid',
        pending: s.payment_status === 'unpaid' && s.status === 'complete',
        email: s.customer_details && s.customer_details.email,
        qty: Number(s.metadata && s.metadata.qty),
        amount_total: s.amount_total,
        currency: s.currency
      });
    } catch (e) { return send(res, 404, { error: 'Bestellung nicht gefunden.' }); }
  }

  return send(res, 404, { error: 'Nicht gefunden.' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Methode nicht erlaubt');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) return send(res, 403, 'Verboten');
  fs.readFile(file, function (err, buf) {
    if (err) return send(res, 404, 'Nicht gefunden');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.indexOf('/api/') === 0) {
    api(req, res, url).catch(function (e) {
      console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: 'Serverfehler.' });
    });
  } else serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('Shop läuft auf http://localhost:' + PORT);
    if (!STRIPE_KEY) console.warn('⚠ STRIPE_SECRET_KEY fehlt – Checkout deaktiviert. Siehe README.md');
    if (!WEBHOOK_SECRET) console.warn('⚠ STRIPE_WEBHOOK_SECRET fehlt – Bestellungen werden nicht gespeichert.');
  });
}
module.exports = { server, verifySignature, priceFor };
