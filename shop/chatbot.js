/* Shop-Assistent "Peach" – regelbasiert, ohne Server und ohne KI.
   Antwortet nur mit Angaben aus der Produktbeschreibung und dem Shop. Wird per <script src="/shop/chatbot.js" defer> eingebunden. */
(function () {
  'use strict';
  if (window.GlassChatbot) return;

  var PRICE = '21,90 €', PRICE_100 = '73,00 €';
  var LS = 'gs-chat-v1', OPEN = 'gs-chat-open';

  /* ---------- Wissen ---------- */
  var CHIPS_MAIN = ['Was ist das Serum?', 'Inhaltsstoffe', 'Für meine Haut?', 'Anwendung', 'Versand & Kosten', 'Bestellen'];

  var INTENTS = [
    { id: 'bot', kw: ['bist du ein bot', 'bist du eine ki', 'bist du ein mensch', 'bist du echt', 'roboter', 'chatbot', 'wer bist du', 'wie heisst du', 'kuenstliche intelligenz'],
      a: 'Ich bin <b>Peach</b>, ein automatischer Shop-Assistent mit vorbereiteten Antworten – keine KI und kein Mensch. Ich kenne mich mit dem Serum, Versand, Zahlung und Bestellung aus.', chips: CHIPS_MAIN },
    { id: 'human', kw: ['mitarbeiter', 'kundenservice', 'kontakt', 'support', 'anrufen', 'telefon', 'beschwerde', 'reklamation', 'echte person', 'mensch sprechen'],
      a: 'Eine Weiterleitung an eine Person kann ich nicht anbieten. Kontaktdaten findest du im Impressum (im Footer) – diese sind im Shop noch nicht hinterlegt.', chips: ['Versand & Kosten', 'Rückgabe'] },
    { id: 'medical', kw: ['schwanger', 'schwangerschaft', 'stillen', 'stillzeit', 'allergie', 'allergisch', 'unvertraeglich', 'neurodermitis', 'ekzem', 'rosazea', 'psoriasis', 'schuppenflechte', 'medikament', 'arzt', 'aerztin', 'hautarzt', 'baby', 'kinder', 'vertraegt'],
      a: 'Dazu kann und darf ich keine medizinische Beratung geben. Bei <b>Schwangerschaft, Stillzeit, Allergien oder Hauterkrankungen</b> frag bitte vorher eine Hautärztin, einen Hautarzt oder ärztliches Fachpersonal. Die vollständige Inhaltsstoffliste steht auf der Verpackung – testen kannst du das Serum zuerst an einer kleinen Hautstelle.', chips: ['Inhaltsstoffe', 'Für meine Haut?'] },
    { id: 'peach', kw: ['pfirsich', 'peach extrakt', 'peach extract', '70 %', '70%', 'prozent pfirsich'],
      a: '<b>Pfirsich-Extrakt (70 %)</b> ist der Hauptbestandteil: Er spendet Feuchtigkeit, wirkt antioxidativ und macht die Haut weich und geschmeidig.', chips: ['Niacinamid', 'Alle Inhaltsstoffe'] },
    { id: 'niacin', kw: ['niacinamid', 'niacin', 'vitamin b3', '5 %', '5%'],
      a: '<b>Niacinamid (5 %)</b> hellt den Teint auf, reduziert Rötungen und Pickelmale und stärkt die Hautbarriere.', chips: ['Hyaluronsäure', 'Alle Inhaltsstoffe'] },
    { id: 'hyal', kw: ['hyaluron', 'hyaluronsaeure'],
      a: '<b>Hyaluronsäure</b> sorgt für intensive Feuchtigkeit, polstert die Haut auf und lässt sie glatter und praller wirken.', chips: ['Centella', 'Alle Inhaltsstoffe'] },
    { id: 'centella', kw: ['centella', 'asiatica', 'pflanzlich', 'tigergras', 'cica'],
      a: '<b>Weitere pflanzliche Inhaltsstoffe</b> wie Centella Asiatica beruhigen die Haut und unterstützen die Regeneration.', chips: ['Alle Inhaltsstoffe', 'Vorteile'] },
    { id: 'ingredients', kw: ['inhaltsstoff', 'alle inhaltsstoffe', 'zutaten', 'enthaelt', 'drin', 'wirkstoff', 'inci', 'zusammensetzung', 'formel'],
      a: 'Die Hauptinhaltsstoffe:<ul><li><b>Pfirsich-Extrakt (70 %)</b> – Feuchtigkeit, antioxidativ, macht die Haut weich</li><li><b>Niacinamid (5 %)</b> – hellt den Teint auf, beruhigt Rötungen, stärkt die Hautbarriere</li><li><b>Hyaluronsäure</b> – intensive Feuchtigkeit, polstert auf</li><li><b>Pflanzliche Stoffe</b> wie Centella Asiatica – beruhigen, unterstützen die Regeneration</li></ul>Die komplette INCI-Liste steht auf der Verpackung.', chips: ['Pfirsich-Extrakt', 'Niacinamid', 'Hyaluronsäure', 'Centella'] },
    { id: 'vegan', kw: ['vegan', 'tierversuch', 'cruelty', 'parfum', 'duftstoff', 'alkohol', 'silikon', 'paraben', 'haltbar', 'ablaufdatum', 'mindesthaltbarkeit', 'pao'],
      a: 'Dazu habe ich keine gesicherten Angaben. Bitte schau auf der Verpackung nach (Inhaltsstoffliste und Haltbarkeitssymbole).', chips: ['Inhaltsstoffe', 'Für meine Haut?'] },
    { id: 'acne', kw: ['akne', 'pickel', 'unreinheit', 'mitesser', 'pore', 'rotung', 'roetung', 'rot ', 'pickelmal', 'narben'],
      a: 'Niacinamid soll <b>Rötungen und Pickelmale reduzieren</b> und die Hautbarriere stärken. Das Serum ist aber ein Pflegeprodukt und kein Medikament – bei starker oder entzündeter Akne ist eine Hautärztin oder ein Hautarzt die richtige Anlaufstelle.', chips: ['Vorteile', 'Anwendung'] },
    { id: 'pigment', kw: ['pigment', 'fleck', 'hautton', 'teint', 'aufhellen', 'dunkle stellen', 'ebenmaessig', 'ungleichmaessig'],
      a: 'Das Serum <b>verbessert den Hautton und mindert Pigmentflecken</b> – dafür sorgt vor allem das Niacinamid (5 %), das den Teint aufhellt.', chips: ['Inhaltsstoffe', 'Anwendung'] },
    { id: 'skin', kw: ['hauttyp', 'empfindlich', 'sensibel', 'trocken', 'fettig', 'mischhaut', 'normale haut', 'reife haut', 'fuer meine haut', 'geeignet', 'passt', 'jede haut', 'alle hauttypen', 'unreine haut'],
      a: 'Das Serum ist laut Produktbeschreibung <b>für alle Hauttypen geeignet – auch für empfindliche Haut</b>. Die Textur ist leicht und zieht schnell ein. Bei bekannten Allergien oder sehr reaktiver Haut teste es zuerst an einer kleinen Stelle und prüfe die Inhaltsstoffliste auf der Verpackung.', chips: ['Vorteile', 'Anwendung'] },
    { id: 'glass', kw: ['glass skin', 'glasshaut', 'glass haut', 'glasglow', 'k beauty', 'kbeauty', 'koreanisch', 'korea', 'glow', 'strahlen', 'glasig'],
      a: '<b>Glass Skin</b> ist der beliebte koreanische Look: glatte, feine, strahlende Haut. Er entsteht nicht durch Filter oder Make-up, sondern durch <b>Feuchtigkeit und Pflege</b> – genau dafür ist das Serum gemacht. 🍑', chips: ['Was ist das Serum?', 'Vorteile'] },
    { id: 'origin', kw: ['herkunft', 'woher', 'suedkorea', 'original', 'echt', 'faelschung', 'anua', 'marke', 'hersteller', 'authentisch'],
      a: 'Das Serum stammt von der koreanischen Skincare-Marke <b>Anua</b> und kommt aus <b>Südkorea</b>.', chips: ['Was ist das Serum?', 'Preis'] },
    { id: 'benefits', kw: ['vorteil', 'wirkung', 'wirkt', 'bringt', 'effekt', 'ergebnis', 'was kann', 'nutzen', 'hilft', 'wofuer'],
      a: 'Das bringt dir das Serum:<ul><li>Natürlicher Glow (Glass-Skin-Effekt)</li><li>Intensive Feuchtigkeit</li><li>Besserer Hautton, weniger Pigmentflecken</li><li>Beruhigt empfindliche Haut</li><li>Leichte, schnell einziehende Textur</li><li>Für alle Hauttypen geeignet</li></ul>', chips: ['Inhaltsstoffe', 'Anwendung'] },
    { id: 'sun', kw: ['sonnenschutz', 'lichtschutz', 'sonne', 'lsf', 'spf', 'sonnencreme'],
      a: 'Ja: Tagsüber sollte <b>Sonnenschutz nicht fehlen</b>. Er kommt als letzter Schritt nach dem Serum und der Feuchtigkeitscreme.', chips: ['Anwendung'] },
    { id: 'usage', kw: ['anwend', 'wende', 'benutz', 'verwend', 'auftragen', 'tropfen', 'wie oft', 'morgens', 'abends', 'routine', 'reihenfolge', 'dosierung', 'einklopfen', 'einmassieren', 'taeglich', 'pipette', 'cleanser', 'reinigung', 'wie nehme', 'wie nutze'],
      a: 'So wendest du das Serum an:<ol><li>Gesicht gründlich reinigen (z. B. mit einem milden Cleanser)</li><li><b>2–3 Tropfen</b> auf die Haut auftragen</li><li>Sanft einklopfen, bis es vollständig eingezogen ist</li><li>Danach eine Feuchtigkeitscreme verwenden – und tagsüber <b>Sonnenschutz</b> nicht vergessen!</li></ol>Gedacht ist es für die tägliche Pflege. Genaue Angaben zu morgens/abends stehen auf der Verpackung.', chips: ['Inhaltsstoffe', 'Bestellen'] },
    { id: 'price', kw: ['preis', 'kostet', 'kosten', 'wie teuer', 'teuer', 'euro', 'guenstig', 'was kostet', 'mwst', 'steuer', '30 ml', 'inhalt', 'menge', 'groesse', 'flasche'],
      a: 'Das <b>Anua Peach 70 Niacin Serum (30 ml)</b> kostet <b>' + PRICE + '</b> inkl. MwSt. (' + PRICE_100 + ' pro 100 ml). Dazu kommen Versandkosten, ab 40 € Warenwert ist der Versand gratis.', chips: ['Versand & Kosten', 'Bestellen'], keep: 'price' },
    { id: 'shipping', kw: ['versand', 'versand kosten', 'versand und kosten', 'der versand', 'versand kostet', 'kostet der versand', 'lieferung', 'liefer', 'liefern', 'dauer', 'wann kommt', 'wie lange', 'zustellung', 'gratis', 'kostenlos', 'express', 'dhl', 'ausland', 'oesterreich', 'schweiz', 'deutschland', 'paket', 'versandkosten', 'ab wann'],
      a: 'Wir liefern nach <b>Deutschland, Österreich und in die Schweiz</b>:<ul><li><b>Standard:</b> 3,90 € – <b>gratis ab 40 € Warenwert</b> (2–4 Werktage)</li><li><b>Express:</b> 6,90 € (1–2 Werktage)</li></ul>', chips: ['Zahlungsarten', 'Bestellen'] },
    { id: 'payment', kw: ['zahlung', 'zahlen', 'bezahl', 'paypal', 'klarna', 'kreditkarte', 'visa', 'mastercard', 'rechnung', 'lastschrift', 'sepa', 'vorkasse', 'zahlart', 'apple pay', 'girocard'],
      a: 'In der Kasse stehen <b>Kreditkarte, PayPal, Rechnung und SEPA-Lastschrift</b> zur Auswahl. Achtung: Die Kasse ist aktuell ein <b>Test-Checkout</b> – es wird nichts bezahlt und nichts gespeichert.', chips: ['Rabattcode', 'Bestellen'] },
    { id: 'discount', kw: ['rabatt', 'gutschein', 'code', 'coupon', 'angebot', 'aktion', 'sparen', 'glow10', 'newsletter'],
      a: 'Zum Ausprobieren gibt es im Test-Checkout den Rabattcode <b>GLOW10</b> (10 %). Du gibst ihn in der Kasse neben der Bestellübersicht ein.', chips: ['Bestellen', 'Zahlungsarten'] },
    { id: 'returns', kw: ['rueckgabe', 'ruecksendung', 'zurueck', 'widerruf', 'umtausch', 'erstatt', 'retoure', 'rueckgabe', 'garantie', 'geld zurueck'],
      a: 'Im Shop steht <b>30 Tage Rückgabe</b>. Die ausführliche Widerrufsbelehrung ist noch nicht hinterlegt – die endgültigen Bedingungen findest du später unter „Widerruf" im Footer.', chips: ['Versand & Kosten', 'Zahlungsarten'] },
    { id: 'order', kw: ['bestell', 'kaufen', 'warenkorb', 'kasse', 'checkout', 'ich nehme', 'haben will', 'moechte ich', 'will ich', 'mitnehmen', 'jetzt holen'],
      a: 'So bestellst du: Menge wählen → <b>„In den Warenkorb"</b> → <b>„Zur Kasse"</b> → Daten eingeben und bestellen. Soll ich dir das Serum direkt in den Warenkorb legen?', chips: ['Versand & Kosten', 'Zahlungsarten'], act: 'cart' },
    { id: 'product', kw: ['was ist das', 'was ist dieses', 'serum', 'produkt', 'beschreibung', 'erzaehl', 'erklaer', 'peach 70', 'niacin serum', 'ueber das', 'infos'],
      a: 'Das <b>Anua Peach 70 Niacin Serum</b> (30 ml, Südkorea) ist ein beliebtes koreanisches Serum für den Glass-Skin-Look. Es verbindet <b>70 % Pfirsich-Extrakt</b> mit <b>5 % Niacinamid</b> und Hyaluronsäure: Es hellt die Haut auf, beruhigt sie und versorgt sie intensiv mit Feuchtigkeit.', chips: ['Inhaltsstoffe', 'Vorteile', 'Anwendung', 'Bestellen'] },
    { id: 'thanks', kw: ['danke', 'dankeschoen', 'super', 'perfekt', 'prima', 'cool', 'klasse', 'toll', 'merci', 'top'],
      a: 'Sehr gern! 🍑 Sag Bescheid, wenn du noch etwas wissen möchtest.', chips: ['Bestellen', 'Versand & Kosten'] },
    { id: 'bye', kw: ['tschuess', 'ciao', 'bye', 'auf wiedersehen', 'bis spaeter', 'bis bald'],
      a: 'Tschüss und einen schönen Glow! ♡', chips: [] },
    { id: 'greet', kw: ['hallo', 'hi', 'hey', 'moin', 'servus', 'guten tag', 'guten morgen', 'guten abend', 'huhu', 'gruess'],
      a: 'Hallo! 🍑 Ich bin Peach, der Assistent des Glass Skin Shops. Frag mich zum Serum, zu Versand, Zahlung oder Bestellung.', chips: CHIPS_MAIN }
  ];

  var norm = function (s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  INTENTS.forEach(function (it) { it.nkw = it.kw.map(function (k) { return k.indexOf(' ') > -1 && k.slice(-1) === ' ' ? ' ' + norm(k) + ' ' : norm(k); }); });

  // Gibt den besten Intent zurück (oder null). Mehrwort-Treffer zählen mehr als Einzelwörter.
  function match(text) {
    var t = norm(text); if (!t) return null;
    var padded = ' ' + t + ' ', tokens = t.split(' '), best = null, bestScore = 0;
    INTENTS.forEach(function (it) {
      var score = 0;
      it.nkw.forEach(function (k) {
        var hit = false, n = k.trim();
        if (!n) return;
        if (n.indexOf(' ') > -1) hit = padded.indexOf(' ' + n) > -1;
        else if (n.length <= 3) hit = tokens.indexOf(n) > -1;
        else if (n.length <= 5) hit = tokens.some(function (w) { return w.indexOf(n) === 0; });
        else hit = t.indexOf(n) > -1;
        if (hit) score += n.indexOf(' ') > -1 ? 2 : 1;
      });
      if (score > bestScore) { bestScore = score; best = it; }
    });
    return best;
  }

  var CHIP_TO_TEXT = { 'Pfirsich-Extrakt': 'pfirsich extrakt', 'Niacinamid': 'niacinamid', 'Hyaluronsäure': 'hyaluronsäure', 'Centella': 'centella', 'Alle Inhaltsstoffe': 'inhaltsstoffe', 'Preis': 'preis', 'Rückgabe': 'rückgabe', 'Vorteile': 'vorteile', 'Rabattcode': 'rabattcode', 'Zahlungsarten': 'zahlung', 'Versand & Kosten': 'versand' };

  /* ---------- Oberfläche ---------- */
  var css = '' +
    '.gsc *{box-sizing:border-box}' +
    '.gsc{--r:#b0657a;--rd:#964f64;--rl:#f3cfd5;--bg:#fbf1f1;--line:#efd3d7;--ink:#1c1b1d;--muted:#6f6469;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14.5px;line-height:1.45;color:var(--ink)}' +
    '.gsc-fab{position:fixed;right:20px;bottom:20px;z-index:35;width:60px;height:60px;border-radius:50%;border:0;background:var(--r);color:#fff;font-size:1.7rem;cursor:pointer;box-shadow:0 8px 24px rgba(150,79,100,.4);display:grid;place-items:center;transition:transform .15s,background .15s}' +
    '.gsc-fab:hover{background:var(--rd);transform:scale(1.06)}' +
    '.gsc-fab:focus-visible,.gsc button:focus-visible,.gsc input:focus-visible{outline:2px solid var(--rd);outline-offset:2px}' +
    '.gsc-tip{position:fixed;right:90px;bottom:32px;z-index:35;background:#fff;border:1px solid var(--line);border-radius:14px 14px 4px 14px;padding:9px 14px;box-shadow:0 6px 20px rgba(0,0,0,.1);font-size:.86rem;cursor:pointer;animation:gscin .3s}' +
    '.gsc-panel{position:fixed;right:20px;bottom:92px;z-index:36;width:372px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 116px);background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 50px rgba(60,30,40,.25);display:none;flex-direction:column;overflow:hidden}' +
    '.gsc-panel.open{display:flex;animation:gscin .2s}' +
    '@keyframes gscin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.gsc-head{background:var(--r);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px}' +
    '.gsc-av{width:38px;height:38px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:1.3rem;flex:none}' +
    '.gsc-head b{display:block;font-size:.98rem}.gsc-head small{opacity:.9;font-size:.76rem}' +
    '.gsc-head .t{flex:1}' +
    '.gsc-head button{background:none;border:0;color:#fff;cursor:pointer;font-size:1.2rem;padding:4px 7px;border-radius:6px;opacity:.9}.gsc-head button:hover{background:rgba(255,255,255,.18)}' +
    '.gsc-log{flex:1;overflow-y:auto;padding:14px;background:var(--bg);display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth}' +
    '.gsc-m{max-width:86%;padding:9px 13px;border-radius:15px;word-wrap:break-word;animation:gscin .2s}' +
    '.gsc-m.b{background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px;align-self:flex-start}' +
    '.gsc-m.u{background:var(--r);color:#fff;border-bottom-right-radius:4px;align-self:flex-end;white-space:pre-wrap}' +
    '.gsc-m ul,.gsc-m ol{margin:6px 0 2px 18px}.gsc-m li{margin:2px 0}' +
    '.gsc-m a{color:var(--rd)}' +
    '.gsc-act{display:inline-block;margin-top:8px;background:var(--r);color:#fff;border:0;border-radius:99px;padding:7px 14px;font:inherit;font-weight:600;font-size:.85rem;cursor:pointer}.gsc-act:hover{background:var(--rd)}' +
    '.gsc-dots{display:flex;gap:4px;padding:12px 14px}.gsc-dots i{width:7px;height:7px;border-radius:50%;background:#c9b3b8;animation:gscb 1s infinite}.gsc-dots i:nth-child(2){animation-delay:.15s}.gsc-dots i:nth-child(3){animation-delay:.3s}' +
    '@keyframes gscb{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}' +
    '.gsc-chips{display:flex;gap:7px;padding:9px 12px 4px;background:var(--bg);overflow-x:auto;flex-wrap:nowrap;border-top:1px solid var(--line);scrollbar-width:none}' +
    '.gsc-chips::-webkit-scrollbar{display:none}.gsc-chips:empty{display:none}' +
    '.gsc-chip{flex:none;background:#fff;border:1px solid var(--r);color:var(--rd);border-radius:99px;padding:6px 12px;font:inherit;font-size:.82rem;cursor:pointer;white-space:nowrap}.gsc-chip:hover{background:var(--rl)}' +
    '.gsc-form{display:flex;gap:8px;padding:10px 12px;background:var(--bg)}' +
    '.gsc-form input{flex:1;min-width:0;border:1px solid var(--line);border-radius:99px;padding:10px 15px;font:inherit;font-size:.95rem;background:#fff}' +
    '.gsc-form button{border:0;background:var(--r);color:#fff;border-radius:50%;width:42px;height:42px;font-size:1.1rem;cursor:pointer;flex:none}.gsc-form button:hover{background:var(--rd)}' +
    '.gsc-note{font-size:.7rem;color:var(--muted);text-align:center;padding:0 12px 8px;background:var(--bg)}' +
    '@media(max-width:480px){.gsc-panel{right:0;left:0;bottom:0;width:100%;max-width:none;height:88vh;max-height:none;border-radius:18px 18px 0 0}.gsc-fab{right:14px;bottom:14px}.gsc-tip{right:82px;bottom:24px}}' +
    '@media(prefers-reduced-motion:reduce){.gsc *{animation:none!important;scroll-behavior:auto!important}}';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var root = el('div', 'gsc');
    root.innerHTML =
      '<button class="gsc-fab" id="gscFab" aria-label="Chat mit dem Shop-Assistenten öffnen" aria-expanded="false" aria-controls="gscPanel">🍑</button>' +
      '<section class="gsc-panel" id="gscPanel" role="dialog" aria-label="Shop-Assistent Peach">' +
        '<header class="gsc-head"><div class="gsc-av" aria-hidden="true">🍑</div><div class="t"><b>Peach</b><small>Automatischer Shop-Assistent</small></div>' +
        '<button type="button" id="gscReset" title="Neu starten" aria-label="Gespräch neu starten">↺</button><button type="button" id="gscClose" aria-label="Chat schließen">✕</button></header>' +
        '<div class="gsc-log" id="gscLog" role="log" aria-live="polite"></div>' +
        '<div class="gsc-chips" id="gscChips"></div>' +
        '<form class="gsc-form" id="gscForm" autocomplete="off"><input id="gscIn" type="text" maxlength="300" placeholder="Frag mich etwas …" aria-label="Deine Nachricht"><button type="submit" aria-label="Senden">➤</button></form>' +
        '<div class="gsc-note">Automatische Antworten – keine medizinische Beratung.</div>' +
      '</section>';
    document.body.appendChild(root);

    var $ = function (id) { return document.getElementById(id); };
    var fab = $('gscFab'), panel = $('gscPanel'), log = $('gscLog'), chips = $('gscChips'), form = $('gscForm'), input = $('gscIn');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hist = [], misses = 0, busy = false, tip = null;

    function save() { try { sessionStorage.setItem(LS, JSON.stringify(hist.slice(-40))); } catch (e) {} }
    function scroll() { log.scrollTop = log.scrollHeight; }
    function addMsg(who, content, isHtml, silent) {
      var m = el('div', 'gsc-m ' + who);
      if (isHtml) m.innerHTML = content; else m.textContent = content;
      log.appendChild(m); scroll();
      if (!silent) { hist.push({ w: who, c: content, h: !!isHtml }); save(); }
      return m;
    }
    function setChips(list) {
      chips.innerHTML = '';
      (list || []).forEach(function (c) {
        var b = el('button', 'gsc-chip'); b.type = 'button'; b.textContent = c; b.setAttribute('data-chip', c); chips.appendChild(b);
      });
    }
    var hasShop = function () { return !!document.getElementById('add'); };

    function say(html, chipList, act) {
      busy = true;
      var dots = el('div', 'gsc-m b gsc-dots', '<i></i><i></i><i></i>'); log.appendChild(dots); scroll();
      setTimeout(function () {
        dots.remove();
        var content = html;
        if (act === 'cart') content += '<br><button type="button" class="gsc-act" data-act="cart">' + (hasShop() ? 'In den Warenkorb legen' : 'Zum Produkt') + '</button>';
        addMsg('b', content, true);
        setChips(chipList); busy = false;
      }, reduce ? 0 : Math.min(900, 350 + html.length * 1.2));
    }

    function respond(text) {
      var it = match(text);
      if (it) { misses = 0; say(it.a, it.chips, it.act); return; }
      misses++;
      say(misses > 1
        ? 'Da kann ich leider nicht weiterhelfen. Ich beantworte Fragen zum Serum, zu Versand, Zahlung und Bestellung. Für alles andere schau bitte ins Impressum (Footer).'
        : 'Dazu habe ich leider keine Antwort. Ich kenne mich mit dem Serum, Versand, Zahlung und Bestellung aus – zum Beispiel:', CHIPS_MAIN);
    }

    function ask(text) {
      text = text.trim(); if (!text || busy) return;
      addMsg('u', text, false); setChips([]);
      respond(CHIP_TO_TEXT[text] || text);
    }

    function start() {
      log.innerHTML = ''; hist = []; misses = 0; save();
      say('Hallo! 🍑 Ich bin <b>Peach</b>, der Assistent des Glass Skin Shops. Ich beantworte Fragen zum <b>Anua Peach 70 Niacin Serum</b>, zu Versand, Zahlung und Bestellung. Was möchtest du wissen?', CHIPS_MAIN);
    }

    function restore() {
      var h = null; try { h = JSON.parse(sessionStorage.getItem(LS)); } catch (e) {}
      if (!h || !h.length) return false;
      hist = h; h.forEach(function (m) { addMsg(m.w, m.c, m.h, true); });
      setChips(CHIPS_MAIN); return true;
    }

    function setOpen(o) {
      panel.classList.toggle('open', o); fab.setAttribute('aria-expanded', o); fab.textContent = o ? '✕' : '🍑';
      fab.setAttribute('aria-label', o ? 'Chat schließen' : 'Chat mit dem Shop-Assistenten öffnen');
      try { sessionStorage.setItem(OPEN, o ? '1' : '0'); } catch (e) {}
      if (tip) { tip.remove(); tip = null; }
      if (o) { if (!log.children.length && !restore()) start(); setTimeout(function () { scroll(); if (window.innerWidth > 480) input.focus(); }, 30); }
    }

    fab.onclick = function () { setOpen(!panel.classList.contains('open')); };
    $('gscClose').onclick = function () { setOpen(false); fab.focus(); };
    $('gscReset').onclick = function () { if (!busy) { start(); input.focus(); } };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('open')) { setOpen(false); fab.focus(); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; ask(v); });
    chips.addEventListener('click', function (e) { var b = e.target.closest('[data-chip]'); if (b) ask(b.getAttribute('data-chip')); });
    log.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.getAttribute('data-act') === 'cart') {
        var add = document.getElementById('add');
        if (add) {
          add.click();
          if (window.innerWidth <= 480) setOpen(false);
          addMsg('b', 'Erledigt – das Serum liegt im Warenkorb. 🛍 Mit „Zur Kasse" geht es weiter.', true);
          setChips(['Versand & Kosten', 'Zahlungsarten']);
        } else location.href = '/shop/#produkt';
      }
    });

    // Kleiner Hinweis, einmal pro Sitzung
    var wasOpen = false, seenTip = false;
    try { wasOpen = sessionStorage.getItem(OPEN) === '1'; seenTip = sessionStorage.getItem('gs-chat-tip') === '1'; } catch (e) {}
    if (wasOpen) setOpen(true);
    else if (!seenTip) setTimeout(function () {
      if (panel.classList.contains('open')) return;
      tip = el('div', 'gsc-tip', 'Fragen zum Serum? 🍑'); tip.onclick = function () { setOpen(true); };
      root.appendChild(tip);
      try { sessionStorage.setItem('gs-chat-tip', '1'); } catch (e) {}
      setTimeout(function () { if (tip) { tip.remove(); tip = null; } }, 7000);
    }, 3500);
  }

  window.GlassChatbot = { match: function (t) { var i = match(t); return i ? i.id : null; },
    chips: function () { var all = {}; INTENTS.forEach(function (it) { (it.chips || []).forEach(function (c) { all[c] = 1; }); }); CHIPS_MAIN.forEach(function (c) { all[c] = 1; }); return Object.keys(all).map(function (c) { return [c, match(CHIP_TO_TEXT[c] || c) ? match(CHIP_TO_TEXT[c] || c).id : null]; }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
