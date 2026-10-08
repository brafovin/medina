// Lokaler Entwicklungs-/Eigenhosting-Server (ohne Abhängigkeiten): `npm start` in shop/.
// Auf Vercel wird er NICHT benutzt – dort übernehmen die Funktionen in /api dieselbe Logik (core.js).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('./core.js');

core.loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT) || 3000;

// Nur diese Dateien werden öffentlich ausgeliefert (kein server.js, .env, data/ …).
const FILES = {
  '/shop/': ['index.html', 'text/html; charset=utf-8'],
  '/shop/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/shop/danke.html': ['danke.html', 'text/html; charset=utf-8'],
  '/shop/serum.jpg': ['serum.jpg', 'image/jpeg'],
  '/shop/serum-produkt.jpg': ['serum-produkt.jpg', 'image/jpeg']
};

function send(res, status, body, headers) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
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

async function api(req, res, url) {
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    let qty;
    try { qty = JSON.parse((await readBody(req, 2048)).toString() || '{}').qty; }
    catch (e) { return send(res, 400, { error: 'Ungültige Anfrage.' }); }
    const r = await core.createCheckout(qty, req.headers);
    return send(res, r.status, r.body);
  }
  if (url.pathname === '/api/webhook' && req.method === 'POST') {
    const raw = (await readBody(req, 1024 * 1024)).toString('utf8');
    const r = core.handleWebhook(raw, req.headers['stripe-signature']);
    return send(res, r.status, r.body);
  }
  if (url.pathname === '/api/order' && req.method === 'GET') {
    const r = await core.getOrder(url.searchParams.get('session_id'));
    return send(res, r.status, r.body);
  }
  return send(res, 404, { error: 'Nicht gefunden.' });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.indexOf('/api/') === 0) {
    return api(req, res, url).catch(function (e) {
      console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: 'Serverfehler.' });
    });
  }
  if (url.pathname === '/' || url.pathname === '/shop') return send(res, 302, '', { Location: '/shop/' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Methode nicht erlaubt');
  const f = FILES[url.pathname];
  if (!f) return send(res, 404, 'Nicht gefunden');
  fs.readFile(path.join(__dirname, f[0]), function (err, buf) {
    if (err) return send(res, 404, 'Nicht gefunden');
    res.writeHead(200, { 'Content-Type': f[1], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': f[1].indexOf('html') > 0 ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('Shop läuft auf http://localhost:' + PORT + '/shop/');
    if (!process.env.STRIPE_SECRET_KEY) console.warn('⚠ STRIPE_SECRET_KEY fehlt – Checkout deaktiviert. Siehe README.md');
    if (!process.env.STRIPE_WEBHOOK_SECRET) console.warn('⚠ STRIPE_WEBHOOK_SECRET fehlt – Bestellungen werden nicht gespeichert.');
  });
}
module.exports = { server };
