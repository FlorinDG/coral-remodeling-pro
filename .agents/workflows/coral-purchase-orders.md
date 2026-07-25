# CORAL — PURCHASE ORDERS (in + out) & PROJECT DOCUMENT INTEGRATION (Planner spec 2026-07-12)

**Florin:** "we also need to introduce purchase orders. incoming and outgoing. and of course, the integration of all this in the project management."

## What exists today
System databases: `db-invoices` (Sales Invoices) · `db-expenses` (Purchase Invoices) · `db-quotations` · `db-tickets` · `db-clients` · `db-suppliers` · `db-payments-in` · `db-payments-out` · plus `db-1` (Projects), `db-tasks`, `db-articles`, `db-bestek`.
**There is NO purchase-order document.** The existing `admin/projects-management/po/[id]` route is a **print view derived from a project's TASKS** (a materials-reservation sheet) — no PO record, no supplier, no numbering, no status, no matching. Real POs are a new build.

## The document ladder (target)
```
PROPOSAL ──convert──▶ QUOTATION ──accepted──▶ [client PO IN] ──▶ SALES INVOICE ──▶ payment in
                                    │
PROJECT ◀───────────────────────────┴── everything hangs off the project
   │
   └── supplier PO OUT ──▶ PURCHASE INVOICE (db-expenses) ──▶ payment out
```

---

## PART 1 — OUTGOING PO (bestelbon uit — we order from a supplier)
- [ ] **PO-OUT** — new document type + database (`db-po-out`, "Purchase Orders"):
  - **Fields:** PO number (own series), **supplier** (relation → `db-suppliers`), **project** (relation → `db-1`), order date, requested delivery date, delivery address (default = project site location), lines (article/description · qty · unit · unit price · line total), totals + VAT regime, notes, attachments.
  - **Lines:** reuse the block/line model; may be seeded from `db-articles`/`db-bestek` or from project tasks (the current materials-sheet becomes a *source*, not the document).
  - **Status:** `draft → sent → confirmed → (partially) received → closed | cancelled`.
  - **Send:** PDF + email to the supplier (reuse the unified send modal). *Peppol ORDER transaction is out of scope for v1 — email/PDF only.*
  - **THE PAYOFF — match to the purchase invoice:** link a PO to the incoming supplier invoice(s) in `db-expenses`, and surface **ordered vs invoiced** variance (over-billing, partial delivery). Feeds the receipt-bulk auto-confirm gate: an invoice matching an open PO is far safer to auto-approve.

## PART 2 — INCOMING PO (bestelbon in — the client orders from us)
- [ ] **PO-IN** — new document type + database (`db-po-in`, "Client Orders"):
  - **Fields:** our reference + **the client's PO number** (critical: B2B/public clients require their PO ref printed on the invoice), **client** (relation → `db-clients`), **project**, date, lines/value, source quotation (relation), attachment (their PDF order).
  - **Flow:** arrives after a quote is accepted → becomes the authorization to invoice. The **sales invoice must carry the client's PO number** (add it to the invoice + PDF; also maps to the UBL `OrderReference` for Peppol).
  - **Status:** `received → in execution → invoiced → closed`.
  - Can be created manually or from an accepted quotation (carry lines + client + project).

## PART 3 — PROJECT-MANAGEMENT INTEGRATION (the point of all this)
- [ ] **PROJ-DOC-ROLLUP** — every document type relates to a project and rolls up in the project detail. **Extends `PROJECT-TOTALS-AGGREGATE`** (which currently sums quotes + invoices) with the **commitment layer**:
  - **Revenue side:** proposals (informational) → quoted (sum of ALL linked quotes) → **ordered by client (PO-IN)** → invoiced (sum of linked sales invoices) → paid (payments-in).
  - **Cost side:** **committed (open PO-OUT — ordered, not yet invoiced)** → actual cost (linked purchase invoices `db-expenses`) → paid (payments-out).
  - **Why committed cost matters:** without it a project looks profitable until the supplier invoices land. Committed + actual = the real cost position.
  - **Project detail UI:** one "Documents" panel listing every linked doc (proposal/quote/PO-in/PO-out/purchase invoice/sales invoice/payments) with status + amount, each opening its record; plus the financial roll-up above.
  - **Margin view:** quoted vs (committed + actual cost) vs invoiced vs paid — the real project P&L.

---

## PART 4 — PHASING (build order)
1. **PO-OUT** first — it's the operational gap (you order materials/subcontracting constantly) and it feeds cost control + the receipt-bulk matching.
2. **PROJ-DOC-ROLLUP** (committed cost + documents panel) — immediately makes PO-OUT valuable.
3. **PO-IN** — smaller; mostly a reference-carrier so the client's PO number reaches the invoice/UBL.
4. Peppol ORDER transactions — later, optional.

## PART 5 — DECISIONS (Florin)
- **Numbering — DECIDED (Florin 2026-07-12): `PO-yyyy-xxx`** for outgoing POs (e.g. `PO-2026-001`), matching the existing doc-number pattern. (PO-IN can follow the same shape, e.g. `POI-yyyy-xxx`, unless Florin says otherwise.) Own series per doc type, profile-respecting numbering source (reuse `getNextDocumentNumber`).
- **PO-OUT lines from project tasks?** Should the existing task-derived materials sheet become the seed for a PO-OUT (one click: tasks → PO)?
- **Partial deliveries/receipts** — track goods receipt separately (a receipt step), or is invoice-matching enough for v1? (Recommend: invoice-matching only in v1, keep it simple.)
- **Does a PO-OUT require approval** above a threshold before sending (foreman/owner gate)?
- **⚠️ SCHEMA NOTE:** two new system databases (`db-po-out`, `db-po-in`) — per the DATA-SAFETY hard rule this is **additive** (new canonical DBs, existing data untouched), which is the sanctioned growth path. No migration of existing records.
