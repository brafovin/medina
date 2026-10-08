// Vercel-Funktion: POST /api/checkout  { qty }  ->  { url } (Weiterleitung zu Stripe)
'use strict';
const core = require('../shop/core.js');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Methode nicht erlaubt.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Ungültige Anfrage.' }); } }
  const r = await core.createCheckout(body && body.qty, req.headers);
  res.status(r.status).json(r.body);
};
