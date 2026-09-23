# App Store Payments Importer for [Billy](https://usebilly.app)

A [Billy](https://usebilly.app) plugin that turns Apple’s monthly **Payments and Financial Report** (CSV) or **Financial Report** (TXT) into invoices addressed to Apple—one invoice per legally accountable Apple subsidiary. A payout arrives as a single bank transfer, but its storefronts are billed by different Apple entities; the plugin splits the report by payout currency and invoices each entity separately, as reverse-charge accounting requires.

## What it Does

- **One invoice per Apple subsidiary.** Regions are grouped by the entity that billed them, so a payout spanning several storefronts produces a separate invoice for each Apple company. The TXT isn’t converted to one currency, so it produces one invoice per Apple company *and* currency.
- **Line items.** From the CSV, each region becomes a `Lump Sum` line at its **Proceeds** amount (VAT 0 %)—already converted to your bank account currency, so the lines sum to what was paid out. The TXT lists every transaction, so the invoice is itemized instead: one `Piece` line per product, country and price, with identical purchases added up into the quantity.
- **Refunds.** From the TXT, returns get their own line marked “Refund” with a negative amount, so they’re visible on the invoice and deducted from its total.
- **Reverse-charge note where it applies.** The Ireland invoice gets an automatic reverse-charge marginal note when your tax residency is an EU state other than Ireland (see below).
- **Service period.** Each invoice’s service dates span the reporting month (CSV) or Apple’s exact fiscal period from the report’s start and end date (TXT).
- **Invoice date.** The first day of the month after the reporting period (a June 2026 report → 1 July 2026). For the TXT, that’s Apple’s fiscal month (28 June–1 August 2026 is July → 1 August 2026).
- **Any report language.** Both formats import whatever language your App Store Connect account uses. For the CSV, the invoice dates need a month name the plugin knows (English, German, French, Spanish, Italian, Dutch, Portuguese); other languages import without them.
- **Descriptions.** See [Line Item Descriptions](#line-item-descriptions) for how they’re built and which parts follow your invoice language.

Invoice number, sender details, and payment terms come from your active Billy profile—exactly as if you’d hit **New Invoice**. The currency comes from the report: the bank account currency for the CSV, the sale currency for the TXT.

## Apple Subsidiaries

Attribution follows [Schedule 2, Exhibit A of Apple’s Paid Applications Agreement](https://developer.apple.com/support/downloads/terms/schedules/Schedule-2-and-3-English.pdf), ported from [fedoco/apple-slicer](https://github.com/fedoco/apple-slicer).

| Region (examples) | Invoiced entity |
|---|---|
| Euro-Zone, United Kingdom, Switzerland, China, India, Indonesia, Malaysia, Singapore, Nigeria—and most of Europe, Africa, the Middle East and Asia | Apple Distribution International Limited, Cork, Ireland (VAT `IE9700053D`) |
| Americas / United States | Apple Inc., Cupertino, USA |
| Canada | Apple Canada Inc., Toronto |
| Brazil, Mexico, Chile, Colombia, Peru—and the rest of Latin America and the Caribbean | Apple Services LATAM LLC, Coral Gables, USA |
| Australia, New Zealand | Apple Pty Limited, Sydney |
| Japan | iTunes K.K., Tokyo |
| South Korea (and Apple’s other Asia-Pacific storefronts) | Apple Services Pte. Ltd., Singapore |

The TXT names the country of every sale, so each sale goes to exactly the entity the agreement lists for that country—even where a storefront outside the US sells in US dollars. The CSV only has regional totals, so there attribution keys off the **currency code** in each region label, e.g. `(AUD)`, `(BRL)`. Apple Distribution International (Ireland) covers the large majority of territories, so it is also the default for any currency the plugin doesn’t recognise; a mixed catch-all like **Rest of World** lands there as a labelled line item you can reassign.

## VAT / Reverse Charge

All line items are VAT 0 %.

For the **Apple Distribution International (Ireland)** invoice the plugin fills the marginal note with a reverse-charge notice automatically—but only when your profile’s tax residency is an EU member state other than Ireland. It uses jurisdiction-neutral EU-Directive wording (Art. 196)—in German for a German invoice language, otherwise in English—and includes Apple’s VAT ID `IE9700053D`. Set your own VAT ID in the profile so both IDs appear.

The notice is skipped when:
- your tax residency is **Ireland**—the supply is domestic, so charge Irish VAT, not reverse charge (the plugin’s 0 % is then wrong for this invoice); or
- your tax residency is **outside the EU**—the EU reverse-charge mechanism doesn’t apply; your own country’s export rules do.

The **non-EU entity invoices** (Apple Inc., Apple Canada, Apple Pty, iTunes K.K., Apple Services LATAM, Apple Services Pte.) are supplies to customers outside the EU, generally **outside the scope of EU VAT**. The plugin adds no note to these—add one yourself if your bookkeeping needs it.

Two things to know: the reverse-charge decision is only as good as the **tax residency** set in your profile, and the automatic note needs a Billy build whose plugin import supports the marginal note (older builds simply ignore it). When in doubt, confirm the treatment with your accountant—see also the Disclaimer.

## Install

1. In Billy, open **Settings → Plugins**.
2. Click **Add Plugin…** and select the `App Store.billyplugin` folder—or just drag it onto the list.

## Use

1. In App Store Connect, open **Payments and Financial Reports** and download the monthly report as **CSV**, or the financial report as **TXT**.
2. In Billy, choose **Profile → Import Invoices… → App Store**.
3. Pick the downloaded file. The plugin recognizes the format from its content, and Billy creates the invoices as drafts for you to review.

## Report Formats

### Payments and Financial Report (CSV)

The regional summary of a payout. It uses these columns:

| Column | Used for |
|---|---|
| `Country or Region (Currency)` | Region → Apple subsidiary, and the line-item description |
| `Proceeds` | Line-item amount (already in your bank account currency) |
| `Bank Account Currency` | Invoice currency |

Works with reports in **any App Store Connect language**—only the invoice dates need a month name it knows (English, German, French, Spanish, Italian, Dutch, Portuguese); other languages import without them.
Only the settled payout is imported—summary and “Estimated Proceeds” rows are skipped.

### Financial Report (TXT)

The transaction list, with one row per purchase or refund. It uses these columns:

| Column | Used for |
|---|---|
| `Title` (or `SKU` when empty) | Line-item description, together with the country |
| `Country of Sale` | Line-item description |
| `Quantity` | Line-item quantity—negative for returns, which become separate refund lines |
| `Partner Share` | Line-item unit price |
| `Partner Share Currency` | Apple subsidiary and invoice currency |

The amounts are in the **currency of the sale**, not converted to your bank account currency—the report doesn’t carry an exchange rate.
So a report with several currencies produces one invoice per Apple subsidiary *and* currency (e.g. EUR and GBP both go to Apple Distribution International, as two invoices).
The per-country totals below the transactions aren’t counted again.

## Line Item Descriptions

| Line | Description | Example (German invoice) |
|---|---|---|
| CSV region | Proceeds prefix + region | `App-Store-Erlöse: Euro-Zone` |
| TXT purchase | Product + country | `12 Monate (Student), Deutschland` |
| TXT refund | Refund prefix + product + country | `Erstattung: 12 Monate (Student), Deutschland` |

What follows your profile’s invoice language and what doesn’t:

- **Prefixes** (“App Store proceeds:” / “Refund:”) are in German for a German invoice language, otherwise in English.
- **Country names** (TXT) are in your invoice language, whatever it is—the country code (e.g. `DE`) if the name isn’t available.
- **Product names** (TXT) are copied from the report, as you named the products in App Store Connect.
- **Region names** (CSV) are copied from the report, in your App Store Connect account’s language, with the currency code removed.
- **Units** (`Piece`, `Lump Sum`) are shown by Billy in its own language.

## Building / Contributing

This folder is a worked example of the Billy [plugin specification](https://usebilly.app/support/plugin-spec). See [`main.js`](./main.js) (format detection + grouping into invoices), [`csv-report.js`](./csv-report.js) (Payments and Financial Report), [`txt-report.js`](./txt-report.js) (Financial Report), [`recipients.js`](./recipients.js) (Apple entities + currency mapping), and [`parsing.js`](./parsing.js) (line / number / date helpers).

To ship updates, set `url` in `plugin.json` and attach a `App Store.billyplugin.zip` to a release.

## Disclaimer

I am not a tax advisor, and this plugin comes with no warranty. It automates data entry—it does not give tax advice. VAT treatment and reverse charge obligations depend on your country’s legislation and your specific situation. Verify for yourself that the generated invoices and their VAT handling are correct, and check the numbers against your actual payout before relying on them.
