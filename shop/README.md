# Glass Skin Shop

Ein-Produkt-Shop (Anua Peach 70 Niacin Serum) mit echtem Checkout über **Stripe Checkout**.
Keine npm-Abhängigkeiten, nur Node ≥ 18.

## Ablauf

1. Kunde legt das Serum in den Warenkorb (`public/index.html`, Warenkorb im Browser).
2. „Weiter zur Zahlung" schickt **nur die Menge** an `POST /api/checkout`.
3. Der Server berechnet Preis und Versand selbst (`server.js`, Konstanten oben), legt eine Stripe-Checkout-Session an und leitet weiter.
4. Stripe erledigt Adresse, E-Mail und Bezahlung (Karte, PayPal, Klarna, SEPA, Apple Pay – je nach Aktivierung im Dashboard).
5. Stripe ruft `POST /api/webhook` auf (Signatur wird geprüft). Bezahlte Bestellungen landen in `data/orders.jsonl`.
6. Kunde kommt auf `public/danke.html`, der Warenkorb wird geleert.

## Einrichten

```bash
cd shop
cp .env.example .env      # Werte eintragen
npm start                 # http://localhost:3000
```

**Stripe-Schlüssel:** Stripe-Konto anlegen → Entwickler → API-Schlüssel → *Secret key* (`sk_test_…` zum Testen) in `.env`.

**Webhook lokal testen** (Stripe CLI):
```bash
stripe listen --forward-to localhost:3000/api/webhook
```
Die ausgegebene `whsec_…` kommt als `STRIPE_WEBHOOK_SECRET` in `.env`. Testkarte: `4242 4242 4242 4242`, beliebiges Datum/CVC.

**Live gehen:** Server auf einem Node-Host betreiben (Render, Railway, Fly.io, eigener Server – statisches Hosting reicht nicht), `PUBLIC_URL` auf die https-Adresse setzen, im Stripe-Dashboard einen Webhook auf `https://DEINE-DOMAIN/api/webhook` mit den Events `checkout.session.completed` und `checkout.session.async_payment_succeeded` anlegen, Live-Schlüssel (`sk_live_…`) eintragen. Beachte: `data/` ist nur auf Hosts mit dauerhaftem Speicher dauerhaft – sonst Bestellungen zusätzlich im Stripe-Dashboard einsehen oder eine Datenbank anbinden.

## Anpassen

Preis, Versandkosten, Gratis-Versand-Grenze, Lieferländer und maximale Menge stehen oben in `server.js`. Dieselben Zahlen zeigt `public/index.html` an (`PRODUCT`, `FREE_FROM`, `SHIPPING`) – bei Änderungen an beiden Stellen anpassen; abgerechnet wird immer der Serverwert.

## Tests

```bash
npm test
```
Startet den Shop gegen einen lokalen Stripe-Mock und prüft Checkout-Session, Preisberechnung, Webhook-Signatur und Bestellspeicherung.

## Vor dem Start noch offen (rechtlich/organisatorisch)

- Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung erstellen und in `public/index.html` (Footer und AGB-Checkbox im Warenkorb) verlinken – derzeit sind es Platzhalter (`#`).
- Versandzeiten in der FAQ eintragen.
- Bestellbenachrichtigung: Stripe-Zahlungsbelege im Dashboard aktivieren (Einstellungen → E-Mails) und ggf. eine eigene E-Mail an dich ergänzen.
- Umsatzsteuer: Preise sind Brutto-Preise; Stripe Tax ist nicht aktiviert.
