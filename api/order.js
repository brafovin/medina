// Vercel-Funktion: GET /api/order?session_id=cs_...  (Daten für die Danke-Seite)
'use strict';
const core = require('../shop/core.js');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Methode nicht erlaubt.' }); }
  const r = await core.getOrder(req.query && req.query.session_id);
  res.status(r.status).json(r.body);
};
