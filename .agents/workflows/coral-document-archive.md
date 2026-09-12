# CORAL — DOCUMENT ARCHIVE — store the issued document, once, at issue — Planner 2026-09-12

**Florin:** *"Automatically generate and store the document was never built, I think. And I was thinking these days about it — it would actually be very useful to have the document, instead of opening the editor just to click export."*

**Confirmed by the BLOB-0 census:** 128 records hold **no stored document**, and **71 of them are already stamped `accountantExportedAt`**. Sales invoices have never had a PDF on file, so the `documenten` folder in every accountant ZIP has only *purchase* documents. This spec closes that at the root.

> **INVARIANT:** *An issued document exists as a file from the moment it is issued. The archived file is what the recipient received, it is never regenerated in place, and every surface that needs "the PDF for this record" reads that one file.*

---

## WHY THIS IS CHEAP — the bytes already exist and are being discarded

`ClientInvoiceEngine.tsx` renders the PDF **client-side** and hands the bytes to the server on both transmission paths:

```ts
const blob = await generatePdfBlob(doc, tenant);          // :991 — shared helper
// → email path:   sendInvoiceToClient(id, …, sendModalPdfBase64, …)      :841
// → Peppol path:  fetch('/api/peppol/send', { body: { pdfBase64, … } })  :997-1003
```

Both transmit the file and then **drop it**. Persisting that buffer is nearly free, and it carries a property a re-render can never have: **the archive is byte-identical to the document the client actually received.**

Server-side rendering is also already proven here — `src/app/api/hr/timesheet-export/route.tsx` renders with `@react-pdf/renderer` (`^4.3.2`, installed) outside the browser. So the second stage needs no new infrastructure either.

---

## ONE DECISION, AND I RECOMMEND THE SIMPLER SIDE

**Where does the key go: reuse `receiptUrl`, or add a second property?**

`receiptUrl` today means *"the PDF for this record"* — it is the supplier's document on a purchase, and it is what the accountant export reads for **both** sales and purchases (`financials/export/route.ts:321, 337`). Adding `issuedDocumentKey` alongside it would create **two representations of one concept** — the shape this whole pass exists to remove — and every consumer would have to check both.

**Recommendation: one property, `receiptUrl`, for every record.** Who produced the document is already knowable from the record type; it does not need a second field.

**Related cleanup, same pass:** the field is displayed under **two different names** — `'Origineel Document'` (`DatabaseClone.tsx:435`) and `'Bonnetje'` (`:490`). One field, one label. Pick one (`Document`) and localise it per the LOCALISATION DIRECTIVE; the hardcoded Dutch strings are on the list anyway.

---

## THE WORK

### ⚠️ DOC-ARCH-0 · EXPORT-LOCK CONFLICT — resolve before DOC-ARCH-1 🟥
`EXPORT-LOCK-CORE` (shipped, `672c264`) blocks every property change on a record where `accountantExportedAt === true`. **Archiving writes `receiptUrl`** — so manual reconstruction would be refused on precisely the 71 already-exported historical invoices it exists for, and a re-send of an exported invoice could not archive either.

Resolution: a named `ARCHIVE_FIELDS` exemption in `lib/records/export-lock.ts` — `receiptUrl`, `documentReconstructed`, `documentReconstructedAt`. These describe the record's **document**, not its **content**; attaching a file does not change what the invoice says. **No bypass flag, no caller override** — the exemption belongs to the fields, not to who is asking. Full instructions: `coder-directive-doc-archive.md`.

### DOC-ARCH-1 · CAPTURE WHAT WAS TRANSMITTED 🟥 — *after DOC-ARCH-0*
- [ ] In `send-invoice.ts` / `send-quote.ts` and `api/peppol/send`: **before transmitting**, persist the received buffer via the storage abstraction and write the key to `receiptUrl`.
  ```ts
  import { storage } from '@/lib/storage';            // singleton; (key: string, data: Buffer) => Promise<StoragePutResult>
  const key = `t_${tenantId}/documents/${databaseId}/${pageId}/${documentNumber}-v${version}.pdf`;
  const { key: storedKey } = await storage.put(key, pdfBuffer, { contentType: 'application/pdf' });
  ```
- [ ] **Persist before sending, not after.** If storage fails, the send fails with a named error (ERROR-SURFACING DIRECTIVE) — we do not transmit a document we could not archive. *(`storage.read()` was broken for weeks precisely because a write-then-forget path had no reader; this one is read back by the accountant export, so it is exercised.)*
- [ ] **Never overwrite.** If a key exists, write `-v{n+1}`. An issued document is immutable; a corrected one is a **new version**, and both are retained.
- [ ] The success toast already lists attachments (`ATT-4`); it now also confirms the document was archived.

### DOC-ARCH-2 · ISSUE WITHOUT TRANSMISSION 🟧 — *after `R4-1`*
- [ ] An invoice marked sent/issued **without** email or Peppol (printed, handed over, paid in person) must still archive. Render **server-side** with `@react-pdf/renderer` — the pattern in `hr/timesheet-export/route.tsx` — from the same data the engine uses.
- [ ] **Sequenced after `R4-1` deliberately.** There are currently four disagreeing readers of a document's lines; rendering an archive from one of them would freeze a possibly-wrong number into a legal file. DOC-ARCH-1 is exempt from this because it captures bytes the client already produced and sent — it archives reality, not a re-derivation.

### DOC-ARCH-3 · ONE READER FOR "THE DOCUMENT" 🟧
- [ ] Every surface that wants the file for a record goes through one accessor — record detail, `PageModal` preview (`:1279-1290`), accountant export, attachments panel, the portal. No component composes a `/api/files/...` path by hand.
- [ ] Displaying an archived document must not re-render it. If the file exists, it is shown; if it does not, that is stated plainly, not silently filled in with a live render that may differ.

### DOC-ARCH-4 · THE TRIGGER IS ISSUE, NOT SAVE 🟥
- [ ] Archive on the **status transition to sent/issued** — never on every save. A draft changes continuously; archiving each revision is storage churn and produces files that were never anybody's invoice.
- [ ] Ties to `EXPORT-LOCK-CORE`: issue is also the moment the record should stop being freely editable. Same event, two consequences.

### DOC-ARCH-5 · NO BULK BACKFILL — manual reconstruction on demand 🟧
**DECIDED (Florin, 2026-09-12): *"historical documents will be manually, as needed, reconstructed."*** No bulk backfill job. Do not write one, do not offer one.

Why the decision is right: templates, VAT handling and totals logic have all changed since those 128 invoices went out, so a regenerated PDF may not match what the client received. A bulk job would silently manufacture 128 plausible-looking documents that are not the issued ones.

- [ ] **"Archive this document" action** on the invoice/quote engine — the surface Florin already opens to click export. It renders with the **existing client-side `generatePdfBlob()`** and stores through the same path as DOC-ARCH-1. **No dependency on DOC-ARCH-2 or R4-1** — it reuses what the editor already does, so it ships alongside DOC-ARCH-1.
- [ ] **Stamped honestly, always:**
  - record: `documentReconstructed: true`, `documentReconstructedAt: <ISO>`
  - filename: `…-reconstructed.pdf`
  - and the record detail **shows** it as a reconstruction, not as the issued document.
- [ ] **An unmarked reconstruction presented as the issued document is a false record** — worse than an absent one. The stamp is not optional and is not a setting.
- [ ] The historical gap otherwise stays visible. For a dispute, the email in Florin's sent folder is better evidence than any re-render.

### DOC-ARCH-6 · TIGHTEN THE EXPORT — *later, deliberately* 🟨
- [ ] Once archiving is live, an **issued** invoice with no archived document is an anomaly worth surfacing in the accountant export.
- [ ] **It must not apply retroactively.** `BLOB-4` strict correctly treats "no `receiptUrl`" as *skip*, not *fail* (correction C2) — that stays, or the 71 legacy stamped records would abort every export. Gate any new requirement on issue date ≥ the feature date.

## VERIFY
1. Send an invoice by email → the PDF is in storage, `receiptUrl` is set, and downloading it yields **the same bytes** the client received.
2. Send via Peppol → same.
3. Break storage deliberately → the send **fails with a named error**; nothing is transmitted.
4. Re-send a corrected invoice → a **`-v2`** file appears; v1 is still retrievable.
5. Run the accountant export for a period containing a newly-sent sales invoice → its PDF is **in the ZIP** (this is the census gap closing).
6. Open the record detail → the archived document is displayed, not re-rendered.
7. Export a period containing only legacy documentless records → still completes (no retroactive strictness).
8. Manual reconstruction of a legacy invoice → the file is stored, the record shows **reconstructed** with its date, and the filename ends `-reconstructed.pdf`. It is never presented as the issued document.
9. `npm run test:compile` · `node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'`

## PLACEMENT
An **L1 ERP-core capability** (`coral-systems-pass.md` → THE SHAPE): *"a document exists as a file"* belongs beside the line reader and the money math, not inside the invoice feature. Quotes, credit notes, purchase orders and bordereaus all acquire it for free by calling down to the same place.
