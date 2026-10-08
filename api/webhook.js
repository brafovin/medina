// Vercel-Funktion: POST /api/webhook  (Stripe ruft sie nach erfolgreicher Zahlung auf)
'use strict';
const core = require('../shop/core.js');

// Stripe prüft die Signatur über den ROHEN Body – deshalb darf Vercel ihn nicht vorher parsen.

module.exports = Object.assign(async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1024 * 1024) return res.status(413).end();
    chunks.push(c);
  }
  const r = core.handleWebhook(Buffer.concat(chunks).toString('utf8'), req.headers['stripe-signature']);
  typeof r.body === 'string' ? res.status(r.status).send(r.body) : res.status(r.status).json(r.body);
}, { config: { api: { bodyParser: false } } });
