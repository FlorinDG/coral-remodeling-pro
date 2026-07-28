# CORAL — PURCHASE INVOICE: LINE RENDERING + ARTICLE LIBRARY LINKING — Planner spec 2026-07-28

## PART 1 — 🟥 PI-LINES-NOT-VISIBLE-UNTIL-EDIT (bug)

**Symptom (Florin):** a purchase invoice arrives, you open it — **the lines don't show**. Click **Edit** — they appear. **Save** — now they persist and render normally.

**Root cause — the writer and the reader disagree about where lines live:**
| | Location |
|---|---|
| **Import writes** | `invoiceLines` — a **JSON string property** (`api/peppol/inbox/route.ts:372`, `api/scan/route.ts:514`: `invoiceLines: JSON.stringify(lines)`) |
| **View reads** | `page.blocks.filter(b => b.type === 'financial-row')` (`PurchaseInvoiceEngine.tsx:223`) — **empty on a fresh import** |
| **Edit reads** | same, **plus a fallback**: `if (lines.length === 0 && peppolDetail?.lines)` (`:236`) ⇒ lines appear |
| **Save writes** | `editData.lines` → `financial-row` blocks (`:352`) ⇒ the view finally works |
| **A third reader** | `PageModal.tsx:359` reads `page.properties['invoiceLines']` directly — a **third** access pattern |

Nothing is lost — the data is in the property the whole time. This is the same "two representations of one concept" defect as `LEAVE-MODEL-DUPLICATION`.

### FIX
- [ ] **PI-LINES-1 · ONE SHARED READER** 🟥 — create `getInvoiceLines(page)` and use it in **every** surface (engine view, engine edit, `PageModal`, PDF template, totals calculation). Resolution order: `blocks[financial-row]` → `properties.invoiceLines` (parse the JSON string, tolerate already-parsed arrays) → `peppolDetail.lines` → `[]`. **No component parses `invoiceLines` on its own again.**
- [ ] **PI-LINES-2 · IMPORT MATERIALISES BLOCKS** 🟥 — at import (Peppol inbox + scan), write the lines as `financial-row` **blocks** in addition to keeping `invoiceLines` for provenance. New invoices then render immediately with no edit-and-save ritual. **Keep `invoiceLines` as the raw as-received record** — useful for audit and for re-deriving if a mapping bug is found later. Blocks become the working copy; the property is the source document.
- [ ] **PI-LINES-3 · BACKFILL (optional, low risk)** 🟨 — for existing invoices with `invoiceLines` but no `financial-row` blocks, materialise blocks once. Additive only; dry-run + count first (`pd.md`). Not strictly needed once PI-LINES-1 lands, since the shared reader covers them.
- **Verify:** a newly arrived Peppol invoice shows its lines on first open, before any edit; totals match; the PDF and the record modal show the same lines; an invoice imported *before* the fix also renders (via the fallback).

---

## PART 2 — 🟧 PI-ARTICLE-LIBRARY (feature, Florin request)

**Florin:** *"make all items in purchase invoices searchable and add the option to add to article library from the invoice, or from the modal that opens when the item is found."*

**Why this is worth building:** purchase invoices are where **real, current cost data** enters the business. Today it lands in an expense record and stops there, while quotes are priced from an article library that ages quietly. Wiring the two means every supplier invoice keeps your quoting prices honest — this is the highest-leverage link in the whole cost chain.

- [ ] **PI-ART-1 · SEARCHABLE LINES** 🟧 — each purchase-invoice line description becomes a **searchable field against `db-articles`** (reuse the quotation engine's existing article `SearchableSelect` — do **not** build a second search). Typing/opening a line offers matching articles; fuzzy match on description, with supplier + unit as tie-breakers.
- [ ] **PI-ART-2 · MATCH MODAL** 🟧 — when a line matches an existing article, the modal shows: the **article** (name, unit, current purchase price, last-updated date) beside the **invoice line** (description, qty, unit, unit price, VAT), and offers:
  - **Link** the line to the article (store `articleId` on the line);
  - **Update the article's purchase price** from this invoice — showing the **delta** (`€12.40 → €13.10, +5.6%`) so a price rise is a decision, not a silent overwrite;
  - **Keep both** (link without repricing);
  - **Not this one** → back to search.
- [ ] **PI-ART-3 · ADD TO LIBRARY** 🟧 — when no match exists, **"Add to article library"** directly from the line (and from the modal). Prefill from the invoice line: description → name, unit, unit price → purchase price, VAT rate, **supplier** (from the invoice), `artikelgroep` (let the user pick; suggest from the supplier's usual group). Creates a `db-articles` record and links the line in one action.
- [ ] **PI-ART-4 · PRICE HISTORY** 🟨 — record each observed purchase price against the article (date, supplier, price, source invoice id). Even a simple append-only list turns the library into a **price-trend record** — you can then see that a supplier has raised a price three times this year, which is exactly the sort of thing that's invisible today.
- [ ] **PI-ART-5 · BULK MATCH — USER-INITIATED ONLY** 🟨 — an invoice-level action **you trigger**: *"Match all lines"* → shows every line with its suggested match (or "new"), you confirm/adjust in one pass, then it applies. On a 40-line builders'-merchant invoice, per-line dialogs are unusable. **Never runs automatically on import** (decided).

### CONSTRAINTS
- **Tenant scoping** — article search and creation strictly `WHERE tenantId = <session>`; never suggest another tenant's articles.
- **Never auto-update prices.** Matching may be automatic; **repricing is always an explicit human action** with the delta shown. A silent price change propagates into every future quote.
- **Reuse, don't duplicate:** the article `SearchableSelect`, the `db-articles` schema, and the creatable-option pattern already exist in the quotation engine (`SCAN-MERCHANT-PREFILL` used the same approach for suppliers).
- Depends on **PART 1** — matching lines that don't render is pointless. Ship PI-LINES-1/2 first.

### ✅ DECISIONS RESOLVED (Florin, 2026-07-28)

**1. SUPPLIER-SPECIFIC PRICING — yes.** Florin: *"in some scenarios I can negotiate on bulk or on grouping with other merch, so it's good to know where I am on a specific supplier."* One price per article is therefore wrong — the same item legitimately has a different price at each merchant, and that spread is negotiating information.
- **Storage (additive, no migration):** a JSON property on the article — `supplierPrices: [{ supplierId, supplierName, price, unit, vatRate, observedAt, sourceInvoiceId }]`. One entry per supplier, updated in place when a newer price is accepted; keep superseded entries in the history (PI-ART-4) rather than overwriting them away.
- **Preferred supplier:** mark one entry as preferred — that's the price quotes default to. Without this, "which price does a quote use" is ambiguous the moment there are two.
- **Payoff:** *"who is cheapest for this item"* and *"what has this supplier done to my prices this year"* both become answerable. Promote to a real table only if cross-supplier querying gets heavy; with a handful of merchants, JSON + in-memory is fine.

**2. NO AUTO-MATCHING — notify instead.** Arriving invoices never link lines to articles by themselves. ⇒ **Delete PI-ART-5's auto-match framing**; bulk matching stays, but it is always user-initiated.
- **Distinction to implement carefully:** *matching* (creating a new link) is **always manual**. *Recognition* (an already-linked article+supplier+description appearing again on a new invoice) is automatic — and when the price differs, it raises a **notification**, never a write.
- **Notification:** *"Partena — Gipsplaat 12,5mm: €12.40 → €13.10 (+5.6%)"*, deep-linking to the article and the source invoice. Reuse the existing notification system (see `NOTIF-INCOMING-INVOICE-DEEPLINK`). **A notification is a signal, not a change** — nothing is updated until Florin acts.

**3. DELTA AT THE POINT OF USE — in the quote engine.** Florin: *"show me a delta in the article when I import into a quote line and offer to update on the fly."* This is the highest-value placement: the price is corrected at the moment it's about to be quoted, not in a maintenance screen nobody visits.
- [ ] **PI-ART-6 · QUOTE-LINE PRICE DELTA** 🟧 — when an article is pulled into a **quotation** line, compare the article's stored price against the **most recently observed purchase price** (preferred supplier, or the cheapest — see below). If they differ, show an inline, non-blocking indicator on the line: *"Library €12.40 · last bought €13.10 (+5.6%) — update?"* with a one-click **update the article** action.
  - **Non-blocking:** never interrupt quoting. If ignored, the quote still uses the library price and the indicator simply stays visible.
  - Updating from here writes the article's price **and** records it in the price history, exactly as the invoice path does — one code path for repricing, not two.
  - Show **which supplier** the observed price came from, so a cheap outlier from an unusual merchant isn't mistaken for the going rate.
  - Applies to the quotation engine; the same helper can serve the invoice engine later.

**4. NOTIFY ON EVERY PRICE CHANGE — the user decides each time.** Florin: *"I wish to decide with every notification whether I will ignore or treat. Automation is good, but the user remains the ultimate authority."*
⇒ **Any** observed price difference on a recognised article+supplier raises a notification. No silent filtering, no "we judged this one too small to mention." The system's job is to **surface** the change; whether it matters is Florin's call, every time.
⇒ A **user-configurable threshold setting** may be added later — as a preference the user sets, not a rule the software imposes. Do not implement one now, and never hard-code one.

**5. DELTA ANCHOR IS A MANUAL CHOICE AT THE POINT OF USE — do not hardcode preferred-vs-cheapest.** Florin: *"delta anchor is manual decision, at the moment of quoting/importing."*
⇒ Revises **PI-ART-6**: when an article enters a quote line, don't silently pick one reference price. Show the **supplier price list for that article** — each supplier with its latest observed price, date, and the delta against the library price — and let Florin choose:
  - which price to **use on this quote line** (this instance only), and/or
  - which price to **write back to the article** (update the library).
  These are two separate actions; using a price on one quote must not silently reprice the library.
  Keep it compact (a small inline popover on the line, 2-4 rows), still **non-blocking** — ignore it and the library price is used.
  Rationale: with negotiated bulk/grouping deals, only Florin knows which merchant this particular job will actually buy from. The system's job is to **present the spread**, not guess.
  *(The `preferred` flag from decision 1 remains useful as the default highlight/sort order — it just no longer decides anything on its own.)*
