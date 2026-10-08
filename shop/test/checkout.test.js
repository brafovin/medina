// Ende-zu-Ende-Test gegen einen lokalen Stripe-Mock (kein Netzwerk, kein echter Schlüssel).
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-test-'));
const WHSEC = 'whsec_testsecret';
const calls = [];

const mock = http.createServer(function (req, res) {
  let body = '';
  req.on('data', function (c) { body += c; });
  req.on('end', function () {
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, params: Object.fromEntries(new URLSearchParams(body)) });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      res.end(JSON.stringify({ id: 'cs_test_abcdefghij', url: 'https://checkout.stripe.test/pay/cs_test_abcdefghij' }));
    } else if (req.method === 'GET' && req.url === '/v1/checkout/sessions/cs_test_abcdefghij') {
      res.end(JSON.stringify({ id: 'cs_test_abcdefghij', payment_status: 'paid', status: 'complete', customer_details: { email: 'kundin@example.com' }, metadata: { qty: '2' }, amount_total: 4380, currency: 'eur' }));
    } else { res.statusCode = 404; res.end(JSON.stringify({ error: { message: 'not found' } })); }
  });
});

function req(port, method, p, body, headers) {
  return new Promise(function (resolve, reject) {
    const r = http.request({ port: port, method: method, path: p, headers: headers }, function (res) {
      let d = ''; res.on('data', function (c) { d += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: d }); });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
const json = function (port, p, obj) { return req(port, 'POST', p, JSON.stringify(obj), { 'Content-Type': 'application/json' }); };
function sign(payload, t) {
  t = t || Math.floor(Date.now() / 1000);
  return 't=' + t + ',v1=' + crypto.createHmac('sha256', WHSEC).update(t + '.' + payload).digest('hex');
}

mock.listen(0, async function () {
  process.env.STRIPE_API_BASE = 'http://127.0.0.1:' + mock.address().port;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC;
  process.env.PUBLIC_URL = 'https://shop.example.com';
  process.env.DATA_DIR = tmp;
  const shop = require('../server.js');
  shop.server.listen(0, async function () {
    const port = shop.server.address().port;
    let ok = 0;
    const t = function (name, fn) { return Promise.resolve().then(fn).then(function () { ok++; console.log('✓', name); }); };
    try {
      await t('Startseite und Danke-Seite werden ausgeliefert', async function () {
        assert.strictEqual((await req(port, 'GET', '/')).status, 200);
        assert.strictEqual((await req(port, 'GET', '/danke.html')).status, 200);
      });

      await t('Quellcode, .env und Pfad-Tricks werden nicht ausgeliefert', async function () {
        for (const p of ['/../server.js', '/..%2Fserver.js', '/%2e%2e/.env', '/server.js', '/.env', '/data/orders.jsonl']) {
          const r = await req(port, 'GET', p);
          assert.ok(r.status === 403 || r.status === 404, p + ' → ' + r.status);
          assert.ok(!/STRIPE_SECRET_KEY|createServer/.test(r.body), p + ' leakt Inhalt');
        }
      });

      await t('Checkout: 1 Stück = 21,90 € + 3,90 € Versand, Preis kommt vom Server', async function () {
        calls.length = 0;
        const r = await json(port, '/api/checkout', { qty: 1, price: 1, unit_amount: 1 }); // Manipulation wird ignoriert
        assert.strictEqual(r.status, 200);
        assert.strictEqual(JSON.parse(r.body).url, 'https://checkout.stripe.test/pay/cs_test_abcdefghij');
        const c = calls[0];
        assert.strictEqual(c.auth, 'Bearer sk_test_mock');
        assert.strictEqual(c.params['line_items[0][price_data][unit_amount]'], '2190');
        assert.strictEqual(c.params['line_items[0][quantity]'], '1');
        assert.strictEqual(c.params['shipping_options[0][shipping_rate_data][fixed_amount][amount]'], '390');
        assert.strictEqual(c.params.success_url, 'https://shop.example.com/danke.html?session_id={CHECKOUT_SESSION_ID}');
        assert.strictEqual(c.params.cancel_url, 'https://shop.example.com/?abgebrochen=1');
        assert.strictEqual(c.params.mode, 'payment');
        assert.strictEqual(c.params['shipping_address_collection[allowed_countries][0]'], 'DE');
      });

      await t('Checkout: ab 40 € Warenwert gratis Versand', async function () {
        calls.length = 0;
        await json(port, '/api/checkout', { qty: 2 });
        assert.strictEqual(calls[0].params['shipping_options[0][shipping_rate_data][fixed_amount][amount]'], '0');
      });

      await t('Checkout: ungültige Mengen werden abgelehnt', async function () {
        for (const q of [0, -1, 11, 1.5, 'abc', null, undefined, [], {}]) {
          const r = await json(port, '/api/checkout', { qty: q });
          assert.strictEqual(r.status, 400, 'qty=' + JSON.stringify(q));
        }
        assert.strictEqual((await req(port, 'POST', '/api/checkout', '{kaputt', {})).status, 400);
      });

      await t('Webhook: falsche/fehlende/alte Signatur wird abgelehnt', async function () {
        const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_x' } } });
        assert.strictEqual((await req(port, 'POST', '/api/webhook', body, {})).status, 400);
        assert.strictEqual((await req(port, 'POST', '/api/webhook', body, { 'Stripe-Signature': 't=1,v1=abc' })).status, 400);
        assert.strictEqual((await req(port, 'POST', '/api/webhook', body, { 'Stripe-Signature': sign(body, Math.floor(Date.now() / 1000) - 3600) })).status, 400);
        assert.strictEqual((await req(port, 'POST', '/api/webhook', body + ' ', { 'Stripe-Signature': sign(body) })).status, 400);
        assert.ok(!fs.existsSync(path.join(tmp, 'orders.jsonl')));
      });

      await t('Webhook: bezahlte Bestellung wird genau einmal gespeichert', async function () {
        const session = { id: 'cs_test_abcdefghij', payment_status: 'paid', amount_total: 4380, currency: 'eur', metadata: { qty: '2' },
          customer_details: { email: 'kundin@example.com' },
          shipping_details: { name: 'Mia Muster', address: { line1: 'Musterstr. 1', postal_code: '10115', city: 'Berlin', country: 'DE' } } };
        const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: session } });
        for (let i = 0; i < 2; i++) assert.strictEqual((await req(port, 'POST', '/api/webhook', body, { 'Stripe-Signature': sign(body) })).status, 200);
        const lines = fs.readFileSync(path.join(tmp, 'orders.jsonl'), 'utf8').trim().split('\n');
        assert.strictEqual(lines.length, 1);
        const o = JSON.parse(lines[0]);
        assert.deepStrictEqual([o.id, o.email, o.name, o.qty, o.amount_total, o.address.city], ['cs_test_abcdefghij', 'kundin@example.com', 'Mia Muster', 2, 4380, 'Berlin']);
      });

      await t('Webhook: unbezahlte Sitzung wird nicht als Bestellung gespeichert', async function () {
        const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_unpaid0001', payment_status: 'unpaid', metadata: { qty: '1' } } } });
        assert.strictEqual((await req(port, 'POST', '/api/webhook', body, { 'Stripe-Signature': sign(body) })).status, 200);
        assert.strictEqual(fs.readFileSync(path.join(tmp, 'orders.jsonl'), 'utf8').trim().split('\n').length, 1);
      });

      await t('Danke-Seite: /api/order liefert nur Anzeige-Daten, ungültige IDs werden abgelehnt', async function () {
        const r = await req(port, 'GET', '/api/order?session_id=cs_test_abcdefghij');
        assert.strictEqual(r.status, 200);
        assert.deepStrictEqual(JSON.parse(r.body), { paid: true, pending: false, email: 'kundin@example.com', qty: 2, amount_total: 4380, currency: 'eur' });
        assert.strictEqual((await req(port, 'GET', '/api/order?session_id=../../v1/account')).status, 400);
        assert.strictEqual((await req(port, 'GET', '/api/order')).status, 400);
      });

      console.log('\n' + ok + ' Tests bestanden');
    } catch (e) {
      console.error('✗ FEHLGESCHLAGEN:', e.message);
      process.exitCode = 1;
    } finally {
      shop.server.close(); mock.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
