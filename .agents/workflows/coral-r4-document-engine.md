# CORAL — R4 · THE DOCUMENT ENGINE — root spec (Planner 2026-09-12)

Governed by `coral-systems-pass.md`. **Fourth. Depends on R2.**

> **INVARIANT:** *The blocks are the document. Every surface renders the same tree through the same reader, and every total is derived once, from that tree.*

---

## THE FINDING

A quotation, an invoice, a purchase invoice and the client-facing portal all render "the document" — and they **disagree**, because each grew its own reader and its own arithmetic:

- **Purchase invoices** keep lines in `invoiceLines` (from Peppol/scan import) while the engine renders `financial-row` **blocks**. A record has lines in one representation and nothing in the other, so the lines are invisible on some surfaces. `PI-LINES-1` exists solely to introduce one shared reader — that is this invariant, stated as a symptom.
- **The portal** computes a leaf-line total from the bare `verkoopPrice`, ignoring the qualifiers the engine applies (`PORTAL-QUOTE-LINE-TOTAL`). The client therefore sees a different number than you do. **That is the worst possible place for the two to disagree.**
- **The PDF template** is a third reader again.
- `buildBlocks` silently dropped non-container children until it was fixed in `lib/block-tree-dnd.ts` — one tree operation, no test, live data loss. It is now pinned by `tests/block-tree.test.ts` (18).

Defect shape #1 again: *two representations of one concept*, four times over, on the documents that carry money to clients.

---

## THE WORK

### R4-1 · ONE READER 🟥
- [ ] `getDocumentLines(page)` — the **only** way any surface obtains the lines of any document. Used by: quote engine (view + edit), invoice engine, `PurchaseInvoiceEngine`, `PageModal`, `InvoicePDFTemplate`, the portal viewer (`quote/[id]`, `bordereau/[id]`, `po/[id]`), and the totals calculation.
- [ ] It resolves the two representations: `financial-row` blocks are authoritative; `invoiceLines` is provenance. Where only `invoiceLines` exists, the reader materialises blocks (`PI-LINES-2`) rather than every consumer coping with both.
- [ ] `grep` gate: no surface reads `properties.invoiceLines` or walks blocks for lines outside this reader.

### R4-2 · TOTALS DERIVED ONCE 🟥
- [ ] `lib/invoice-totals.ts` is already the shared, tested (22 cases) arithmetic. **Every** surface uses it — including the portal, which currently does its own. Delete the local variants.
- [ ] Belgian VAT rules live here and nowhere else: 6% renovation rate, materials following the works rate, medecontractant/reverse-charge.
- [ ] Totals are **never** stored as the source of truth and never conflict-checked — they are derived. *(That is OCC-7: derived fields must never raise a conflict.)*

### R4-3 · ONE TREE, ONE SET OF OPERATIONS 🟧
- [ ] Block insert / move / nest / delete go through `lib/block-tree-dnd.ts` only. It is the piece with a real test suite; the engines must not keep private tree code beside it.
- [ ] Every tree operation asserts the invariants already implemented there (`countBlocks`, id-set equality) in development.
- [ ] Absorbs `ENGINE-CATEGORY-WRAPPERS` and `ENGINE-ADD-BLOCK-AFFORDANCES` — both are tree/afford­ance work that belongs in the consolidated engine, not bolted onto one of the two copies.

### R4-4 · THE PORTAL RENDERS WHAT YOU SENT 🟥
- [ ] The client-facing viewer uses R4-1 and R4-2 with **no exceptions**. A client-visible number that differs from the internal one is a commercial problem, not a display bug.
- [ ] `PORTAL-QUOTE-LINE-TOTAL` closes as a consequence, not as its own patch.

### R4-5 · TENANT-READY BY DESIGN 🟧
- [ ] Public document routes (`quote/[id]`, portal) are **token-scoped capabilities**: the token grants exactly one document. State it at the route, verify the token's scope, and never widen to a tenant-level read behind a public URL.
- [ ] All engine reads go through R1's accessor.

### R4-6 · CHARACTERIZATION FIRST 🟥
- [ ] Before consolidating: pin the **current correct output** of each surface for a fixture set — quote with sections/subcomponents, invoice with credit note, purchase invoice from Peppol import, medecontractant, 6% works. Extends the existing 22 + 18.
- [ ] If two surfaces currently disagree, the test records **both** and Florin picks the correct one. **Do not let the consolidation silently choose** — this is money, and a quiet change to a total on a sent document is unacceptable.

## VERIFY
1. One purchase invoice imported from Peppol shows identical lines in engine view, engine edit, `PageModal` and PDF.
2. A quote's line total is **identical** in the engine, the PDF and the client portal — including a line with qualifiers.
3. 6% works, materials-follow-works, and medecontractant each produce the same totals on every surface.
4. Drag a line with subcomponents → nothing is lost (`block-tree` suite stays green).
5. `grep` gate: no line-reading or total-computing outside the two shared modules.
6. All tests green, including R4-6's fixtures.

## ORDER
**R4-6 (characterization) → R4-1 → R4-2 → R4-4 → R4-3 → R4-5.**
Characterization genuinely first here. This root touches sent documents; the safety net has to exist before the consolidation moves a single number.
