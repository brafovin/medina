# Glass Skin Shop

Ein-Produkt-Shop (Anua Peach 70 Niacin Serum) mit echtem Checkout über **Stripe Checkout**.
Keine npm-Abhängigkeiten, nur Node ≥ 18.

## Ablauf

1. Kunde legt das Serum in den Warenkorb (`index.html`, Warenkorb im Browser).
2. „Weiter zur Zahlung" schickt **nur die Menge** an `POST /api/checkout`.
3. Der Server berechnet Preis und Versand selbst (`core.js`, Konstanten oben), legt eine Stripe-Checkout-Session an und leitet weiter.
4. Stripe erledigt Adresse, E-Mail und Bezahlung (Karte, PayPal, Klarna, SEPA, Apple Pay – je nach Aktivierung im Dashboard).
5. Stripe ruft `POST /api/webhook` auf (Signatur wird geprüft). Die Bestellung wird gespeichert bzw. geloggt (siehe unten).
6. Kunde kommt auf `danke.html`, der Warenkorb wird geleert.

## Aufbau

```
api/checkout.js, webhook.js, order.js   Vercel-Funktionen (liegen im Repo-Root, daher /api/...)
shop/core.js                            gemeinsame Logik (Stripe, Preise, Webhook)
shop/server.js                          lokaler Server für Entwicklung / eigenen Server
shop/index.html, danke.html, *.jpg      die Seiten, erreichbar unter /shop/
vercel.json                             leitet /shop auf /shop/ um
```

## Auf Vercel veröffentlichen

1. Das Vercel-Projekt muss den Branch deployen, in dem `shop/` und `api/` liegen (oder den Branch in `main` mergen). **Root Directory = Repo-Root**, Framework „Other", kein Build-Befehl.
2. Unter *Project → Settings → Environment Variables* eintragen: `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` (`PUBLIC_URL` ist auf Vercel nicht nötig, die Adresse wird aus der Anfrage erkannt). Danach neu deployen.
3. Im Stripe-Dashboard → Entwickler → Webhooks einen Endpunkt `https://DEINE-DOMAIN/api/webhook` anlegen mit den Events `checkout.session.completed` und `checkout.session.async_payment_succeeded`. Dessen Signing-Secret (`whsec_…`) ist `STRIPE_WEBHOOK_SECRET`.
4. Shop öffnen: `https://DEINE-DOMAIN/shop/`.

**Bestellungen auf Vercel:** Das Dateisystem ist dort schreibgeschützt. Jede bezahlte Bestellung (inkl. Adresse) erscheint in den Funktions-Logs (*Vercel → Logs*, Suche „NEUE BESTELLUNG") und immer im Stripe-Dashboard unter *Zahlungen*. Für eine automatische Benachrichtigung oder Datenbank sag Bescheid.

## Lokal / eigener Server

```bash
cd shop
cp .env.example .env      # Werte eintragen
npm start                 # http://localhost:3000/shop/
```

**Stripe-Schlüssel:** Stripe-Konto anlegen → Entwickler → API-Schlüssel → *Secret key* (`sk_test_…` zum Testen) in `.env`.

**Webhook lokal testen** (Stripe CLI):
```bash
stripe listen --forward-to localhost:3000/api/webhook
```
Die ausgegebene `whsec_…` kommt als `STRIPE_WEBHOOK_SECRET` in `.env`. Testkarte: `4242 4242 4242 4242`, beliebiges Datum/CVC. Lokal landen Bestellungen in `shop/data/orders.jsonl`.

## Anpassen

Preis, Versandkosten, Gratis-Versand-Grenze, Lieferländer und maximale Menge stehen oben in `core.js`. Dieselben Zahlen zeigt `index.html` an (`PRODUCT`, `FREE_FROM`, `SHIPPING`) – bei Änderungen an beiden Stellen anpassen; abgerechnet wird immer der Serverwert.

## Tests

```bash
npm test
```
Startet lokalen Server und Vercel-Funktionen gegen einen Stripe-Mock und prüft Checkout-Session, Preisberechnung, Webhook-Signatur und Bestellspeicherung.

## Vor dem Start noch offen (rechtlich/organisatorisch)

- Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung erstellen und in `index.html` (Footer und AGB-Checkbox im Warenkorb) verlinken – derzeit sind es Platzhalter (`#`).
- Versandzeiten in der FAQ eintragen.
- Bestellbenachrichtigung: Stripe-Zahlungsbelege im Dashboard aktivieren (Einstellungen → E-Mails) und ggf. eine eigene E-Mail an dich ergänzen.
- Umsatzsteuer: Preise sind Brutto-Preise; Stripe Tax ist nicht aktiviert.
