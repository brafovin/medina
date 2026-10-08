# Glass Skin Shop (Test-Checkout)

Ein-Produkt-Shop für das Anua Peach 70 Niacin Serum. Reine statische Seiten (HTML/CSS/JS), **kein Backend**.
Der Checkout ist eine **Attrappe**: Er sieht aus wie ein echter, nimmt aber kein Geld, schickt nichts an einen Server und speichert keine Kartendaten.

## Seiten

| Adresse | Datei | Inhalt |
|---|---|---|
| `/shop/` | `index.html` | Produktseite, Warenkorb (gespeichert im Browser) |
| `/shop/checkout.html` | `checkout.html` | Kasse: Kontakt, Adresse, Versandart, Zahlung, Bestellübersicht, Rabattcode |
| `/shop/bestaetigung.html` | `bestaetigung.html` | Bestellbestätigung |

## Was der Test-Checkout kann

- Formularprüfung mit deutschen Fehlermeldungen (E-Mail, PLZ, Kartennummer per Luhn-Test, Ablaufdatum, Sicherheitscode, IBAN)
- Zahlarten: Kreditkarte, PayPal, Rechnung, SEPA (nur Optik, keine Weiterleitung)
- Versandarten Standard (3,90 €, gratis ab 40 €) und Express (6,90 €)
- Rabattcode zum Ausprobieren: `GLOW10` (10 %)
- Button „Testdaten einfügen" in der gelben Leiste, Testkarte `4242 4242 4242 4242`
- Nach „Bestellen" gibt es eine kurze Ladeanzeige, dann die Bestätigung. Der Warenkorb wird geleert.
- Gespeichert wird nur die Bestellübersicht (ohne Kartendaten, nur die letzten 4 Ziffern) bis zum Schließen des Tabs.

## Anpassen

Preis, Versandkosten und Rabattcodes stehen oben im Script von `checkout.html` (`PRICE`, `SHIP_STD`, `SHIP_EXP`, `CODES`) und in `index.html` (`PRODUCT`, `FREE_FROM`, `SHIPPING`).

## Veröffentlichen

Auf Vercel reicht das Repo ohne weitere Einstellungen (`vercel.json` im Repo-Root leitet `/shop` auf `/shop/` um).

## Für einen echten Shop fehlt noch

Zahlungsanbieter mit Server (z. B. Stripe), Bestellspeicherung, E-Mail-Versand sowie Impressum, Datenschutz, AGB und Widerrufsbelehrung (aktuell Platzhalter-Links).
