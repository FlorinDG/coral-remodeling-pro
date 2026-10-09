# DOC-LINES-2 — rounding per line, mixed VAT rates (Planner)

Follows DOC-LINES-1 (the line rule + discounts, promoted 2026-10-09). This is a Planner item because it touches the
canonical totals rule. The rule lives in two places: `lib/records/document-lines.ts` and `lib/invoice-totals.ts`.

## Decided — Florin 2026-10-09

### 1. Round each line, then add ("rounding then adding — it is standard")

Each charged line's net amount is rounded to the cent first. The document's figures are then sums of those rounded
amounts.

The cent gap this fixes: 50% of €66.67 = 33.335. The PDF and Peppol show 33.34, but today's subtotal adds the unrounded
33.335 and rounds once, so the total can differ by €0.01 from the sum of the lines printed. Peppol needs the sum
anyway: BT-106 = Σ BT-131 (BR-CO-10), and every BT-131 has 2 decimals.

### 2. VAT: "la somme des arrondis"

Florin's quote: compute each line's VAT, round it to the cent, then add the VATs per rate.
- The discount on the total takes its own VAT off, rounded the same way, at its rate.
- Peppol accepts this: BR-S-09 allows ±1 currency unit between the stated VAT and taxable × rate. Checked on
  docs.peppol.eu 2026-10-09.
- At the start of the item, confirm with Florin that this is the method for VAT too, and not only for line nets. Show
  him one example where the two methods differ by a cent.

### 3. Mixed rates on one document: YES

- **Line rate.** A line's VAT rate becomes a real line field (`vatRate`). A new line takes the document's default rate
  (`vatRegime`).
- **Editor.** A rate column on the line (select: 21 / 12 / 6 / 0).
- **Totals.** Grouped by rate at the end. `vatBreakdown` already is a per-rate list.
- **PDF.** One VAT row per rate. A per-line rate column only when the document has more than one rate.
- **Peppol.** `tax_rate` per line. The discount on the total is split over the rates in proportion to each rate's base.
  `splitDocumentDiscount` already does this and the last rate takes the rounding cent. That gives one allowance per
  rate (BR-S-08).
- **Reverse charge (medecontractant)** stays a DOCUMENT regime. A reverse-charge document has no line rates (AE on every
  line).

## Scope — root to leaf

1. **Core (`lib/records/document-lines.ts`).** `chargedLines` gains the line's rate, read from the line or else the
   document's default. Line net is rounded at the line.
2. **The rule (`lib/invoice-totals.ts`).** Base per rate = Σ rounded line nets − that rate's share of the discount. VAT
   per rate = Σ round(line net × rate) − round(discount share × rate).
3. **Every reader gets the rule; none gets a copy.**
   - Editors (Row, FinancialRowRenderer, footers).
   - Both PDF templates.
   - QuotationViewer, InvoiceTotalCell, PageModal.
   - `peppol-payload` (+ line `tax`) and `peppol-ubl`, whose TaxSubtotal must come from the rule's figures and not be
     re-computed.
   - Mobile `/m/invoices/new`: it already has a `vatRate` per line but computes its own total. Move it onto the rule.
4. **Remove the dead setting (was VAT-DOC-1).** The tenant `vatCalcMode` ("per line / on total") on the settings
   financials page, in the tenant profile API, and the `vatCalcMode` props threaded through rows. It never changed the
   calculation.
5. **Line VAT already in data.** Before shipping, list existing sales blocks that carry `vatRate` (PDF import and mobile
   set it) and check them against their document's regime. Give Florin the census SQL. No repair feature: a wrong rate
   is fixed in the editor, or the document is deleted and reimported.
6. **Issued documents.** A sent or locked document keeps its stored totals. A recomputed display may move by a cent
   only on drafts. Check which screens recompute (InvoiceTotalCell does).

## Tests — they must be able to fail

- **Line rounding.** 50% of 66.67: subtotal = Σ printed lines.
- **VAT.** The per-line rounded sum, with a case where it differs by a cent from taxable × rate.
- **Mixed rates.** 6% + 21% lines plus a discount on the total. The allowance is split per rate, and the send, the PDF
  totals and the UBL agree to the cent.
- **The old-totals reference** (`tests/_old-invoice-totals.ts`). Equality holds only where no line net has more than 2
  decimals. Change that test deliberately, and say so in the commit.
- **Reverse charge.** A line rate is ignored, and every line goes out as AE.

## Safety

Sending only. Nothing touches the Peppol inbox.
