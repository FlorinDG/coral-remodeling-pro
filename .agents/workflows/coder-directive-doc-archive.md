# CORAL — CODER DIRECTIVE — DOCUMENT ARCHIVE (DOC-ARCH-1 · 4 · 5) — Planner 2026-09-12

Paste-ready. Binding. Spec: `coral-document-archive.md` · protocol: `pd.md` · model rules: `coder-profile.md`.

**Goal in one line:** an issued invoice or quote has its PDF on file from the moment it is issued, and that file is byte-identical to what the client received.

---

## 📎 PASTED FACTS — do not write these from memory

```ts
// src/lib/generate-pdf.ts:12 — CLIENT-SIDE (@react-pdf/renderer pdf().toBlob())
export async function generatePdfBlob(doc: any, tenantProfile?: any): Promise<Blob>;

// src/lib/storage/index.ts — the singleton; the ONLY door to blob storage
import { storage } from '@/lib/storage';
put(key: string, data: string | Buffer | Blob | ArrayBuffer | ReadableStream,
    opts?: { contentType?: string }): Promise<{ key: string; url: string }>;
list(prefix: string): Promise<StorageListEntry[]>;   // { key, url, size, uploadedAt, pathname }
read(key: string): Promise<Buffer>;

// src/lib/records/export-lock.ts — shipped in EXPORT-LOCK-CORE (672c264)
export function checkExportLock(
    existingProperties: Prisma.JsonValue | null,
    incomingProperties: Record<string, unknown>,
    relationPropertyIds: Set<string>
): ExportLockViolation | null;
```

**Where the bytes already are** — both paths receive the rendered PDF and currently discard it:
```ts
// src/app/actions/send-invoice.ts:33   (send-quote.ts is identical)
const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');

// src/app/api/peppol/send/route.ts:16,19
const tenantId = (session!.user as any).tenantId;
const { invoiceId, …, pdfBase64, … } = body;
```

**The invoice/quote number is `properties.title`** (`ClientInvoiceEngine.tsx:171`) — not a separate field.

---

## 🔴 READ THIS FIRST — a conflict between two shipped/planned rules

`EXPORT-LOCK-CORE` blocks **any** property change on a record where `accountantExportedAt === true`, except `accountantExportedAt` itself and relation properties.

**Archiving writes `receiptUrl`.** So:
- **DOC-ARCH-5 would be refused on exactly the records it exists for** — the 71 already-exported historical invoices Florin wants to reconstruct.
- A re-send of an already-exported invoice would also fail to archive.

**The resolution — do this as part of DOC-ARCH-1, before anything else:**
Add an explicit, named exemption set to `src/lib/records/export-lock.ts`:
```ts
/** Fields that describe the record's DOCUMENT, not its content.
 *  Attaching or re-attaching a file does not alter what the invoice says,
 *  so these remain writable on an accountant-exported record. */
export const ARCHIVE_FIELDS = new Set([
    'receiptUrl',
    'documentReconstructed',
    'documentReconstructedAt',
]);
```
and skip them in `checkExportLock` the same way `accountantExportedAt` is skipped.

**Do not** widen the lock any further than these three. **Do not** add a bypass flag, a caller-supplied override, or an "unlock" parameter — the exemption is a property of the *fields*, not of who is asking. Extend `tests/export-lock.test.ts`: each archive field is allowed on a locked record; any other field is still blocked.

---

## 1 · DOC-ARCH-1 · CAPTURE WHAT WAS TRANSMITTED 🟥

### 1a · One shared archive function
**New file `src/lib/records/document-archive.ts`.** One implementation, called from all three send paths.

```ts
import { storage } from '@/lib/storage';

export interface ArchiveResult { key: string; version: number; filename: string; }

/** Persist an issued document. Never overwrites: an existing key produces the next version. */
export async function archiveDocument(params: {
    tenantId: string;
    databaseId: string;
    pageId: string;
    documentNumber: string;          // properties.title
    pdf: Buffer;
    reconstructed?: boolean;         // DOC-ARCH-5 only
}): Promise<ArchiveResult>;
```
- Key shape: `t_${tenantId}/documents/${databaseId}/${pageId}/${safeNumber}-v${n}${reconstructed ? '-reconstructed' : ''}.pdf`
- **Version resolution:** `storage.list(prefix)` for that page's folder, count existing entries, use `n = count + 1`. **Never** overwrite an existing key.
- Sanitise `documentNumber` for the filename the way `financials/export/route.ts` already does (`cleanFileName`) — **read that function and reuse the same rule**; do not invent a second sanitiser.
- Failures **throw** with a named error. No `.catch(() => …)`, no silent skip.

### 1b · Persist BEFORE transmitting
- `src/app/actions/send-invoice.ts` and `send-quote.ts`: after `Buffer.from(pdfBufferBase64,'base64')` at `:33` and **before** `resend.emails.send`.
- `src/app/api/peppol/send/route.ts`: after `pdfBase64` is read from the body and **before** dispatch.
- **If archiving fails, the send does not happen**, and the error names the reason (ERROR-SURFACING DIRECTIVE). We do not transmit a document we could not keep.

### 1c · Write the key onto the record
- Write `receiptUrl = result.key` through an existing server write door — **not** `prisma.globalPage.update` directly.
- **Merge, do not replace:** read the current `properties`, spread, set `receiptUrl`. A whole-object overwrite here would clobber a concurrent edit. *(This is the read-modify-write shape `R2-2` removes structurally; until then, keep the window as small as possible and do the write immediately after the archive.)*
- Tag it as a system write if the door supports it.

### 1d · Confirm it
- The success toast already lists attachments (`ATT-4`); add the archived filename.

---

## 2 · DOC-ARCH-4 · THE TRIGGER IS ISSUE, NOT SAVE 🟥
- Archiving happens **only** on the send/issue paths above. **No archiving on save, autosave, or sync.** A draft changes continuously and archiving revisions produces files that were never anybody's invoice.
- The status transition to `opt-sent` already happens client-side after a successful send (`ClientInvoiceEngine.tsx:853` email, `:1044` Peppol). Leave that as is — the archive is written server-side inside the send, so the two cannot disagree.
- **Do not** hook archiving to the status dropdown (`:1251`). A manual flip to "sent" with no transmission has no PDF; that case is `DOC-ARCH-2` and is **out of scope for this batch**.

---

## 3 · DOC-ARCH-5 · MANUAL RECONSTRUCTION 🟧
**No bulk backfill. Do not write a backfill job, a migration, or a "reconstruct all" action.**

- [ ] **"Archive this document"** action in the invoice and quote engines, beside the existing export/download control. It renders with the **existing client-side `generatePdfBlob(doc, tenant)`** — the same call the send flow uses — and posts the bytes to `archiveDocument({ …, reconstructed: true })`.
- [ ] **Always stamped, never optional:**
  - record: `documentReconstructed: true`, `documentReconstructedAt: <ISO string>`
  - filename: `…-reconstructed.pdf`
  - the record detail and `PageModal` preview label it **as a reconstruction**, not as the issued document.
- [ ] An unmarked reconstruction presented as the issued document is a false record. The stamp is not a setting and has no off switch.

---

---

## ⚠️ PLAN REVIEW — CORRECTIONS BINDING ON THE CODER (Planner 2026-09-12)

Plan accepted in shape. `ARCHIVE_FIELDS`, the key pattern, reusing `cleanFileName`, version-by-listing, abort-before-send, and the stamping in `PageModal` + `DocumentViewerCard` are all correct. **Four corrections.**

### D1 🟥🟥 THE CLIENT WILL CLOBBER `receiptUrl` — the feature would silently undo itself
The plan writes `receiptUrl` **server-side** inside the send action. The client store knows nothing about it. Then, on success, the engine does:
```ts
// ClientInvoiceEngine.tsx:853 — runs AFTER the server action returns
handleUpdateProperty('status', 'opt-sent');
```
That mutates the store's copy of the page — **which has no `receiptUrl`** — and enqueues a sync. `saveGlobalPage` then writes the store's properties over the server's, and **the archive key is gone**. The blob survives, orphaned; the record points at nothing; the accountant export is back to having no sales PDFs. It would look like it worked.

**This is the `server-first write with no client sync` anti-pattern that is already on our recurring-defect list.**

**Required:**
1. `sendInvoiceToClient` / `sendQuoteToClient` / the Peppol route **return the archived key** in their result.
2. The engine applies **`status` and `receiptUrl` in the same store update**, from the returned value — not two separate mutations, and never leaving a window where the store's copy lacks the key.
3. Verify by reloading the record **after** the send completes and the sync settles: `receiptUrl` must still be there. **Check after the queue drains, not immediately** — the clobber happens on the next sync, so an immediate check passes and hides it.

### D2 🟥 NEVER put `updatePageServerFirst`'s return into the store
`src/app/actions/pages.ts:226-227` builds its returned `Page` with hardcoded values:
```ts
blocks: [],
blocksVersion: 1,
```
regardless of the real record. Feeding that into the client store **wipes the document's blocks and resets the OCC version** — data loss plus a guaranteed conflict storm. Use the return for **success/failure only**; take no field from it. *(Pre-existing landmine, not introduced by this plan — logged separately for `R2-1`, which must stop returning a fabricated page.)*

### D3 🟧 A reconstruction must not shadow a genuine archive
`documentReconstructed` is a flag on the **record**, but archives are versioned **per file**. If a record already has a genuine archived PDF and someone clicks "Archiveer document", the plan would stamp the whole record as reconstructed and repoint `receiptUrl` at the reconstruction — **orphaning the real transmitted document and mislabelling a record that has the original.**

**Required:** `reconstructDocumentAction` first checks for an existing **non-reconstructed** archive for that page.
- If one exists → **refuse**, with a message saying the original is already archived. Do not repoint `receiptUrl`.
- Reconstruction is for records with **no** genuine archive. That is the entire use case.

### D4 🟧 Run the whole suite, and delete a dead file
- The plan runs only `tests/export-lock.test.ts`. Run the full glob — baseline **77 tests / 5 files**, with `tests/i18n.test.ts` **already red** (`I18N-MISSING-KEYS`), which is pre-existing and must not be "fixed" by editing or skipping it.
- `src/components/admin/quotations/ClientQuotationEngine 2.tsx` is **0 bytes and imported nowhere**. Delete it in this batch — a stray duplicate beside the file being modified is exactly how the wrong one gets edited later.

---

## 4 · VERIFICATION — these exact commands
```bash
npm run test:compile     # tsc --noEmit, 0 errors
node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
```
Baseline: **77 tests / 5 files**; `tests/i18n.test.ts` is **already red** (`I18N-MISSING-KEYS`, ~16 missing keys) — pre-existing, do not "fix" by editing or skipping the test. `jest` is **not installed**; do not call it.

**Manual:**
1. Send an invoice by email → file in storage, `receiptUrl` set, downloaded bytes identical to what was emailed.
2. Send via Peppol → same.
3. Break storage deliberately → **send fails with a named error**; nothing transmitted, no status change.
4. Send a corrected invoice for the same record → **`-v2`**; v1 still retrievable.
5. Accountant export over a period containing that invoice → **its PDF is in the ZIP** (the census gap closing).
6. Manually reconstruct one of the **already-exported** historical invoices → it succeeds (proves the `ARCHIVE_FIELDS` exemption), is stamped, and is labelled as a reconstruction.
7. Edit any *content* field on that same exported invoice → **still blocked** with the field named.
8. Save a draft repeatedly → **no files are written.**
9. **(D1)** After a send, wait for the sync queue to drain, then reload the record → `receiptUrl` is **still set**. Checking immediately is not sufficient; the clobber happens on the following sync.
10. **(D3)** Click "Archiveer document" on a record that already has a genuine archive → **refused**, with the original left as `receiptUrl`.

## 5 · ORDER AND COMMITS
```
1. EXPORT-LOCK-ARCHIVE-FIELDS: allow document fields on exported records
2. DOC-ARCH-1: archive issued documents on email, quote and Peppol send   (includes D1 — the client must receive and store the key)
3. DOC-ARCH-5: manual document reconstruction with explicit stamping       (includes D3 — refuse when a genuine archive exists)
4. CHORE: delete the 0-byte ClientQuotationEngine 2.tsx
```
One commit per item; `npm run test:compile` green before each. DOC-ARCH-4 is a **constraint on 1**, not its own commit.

## 6 · PROHIBITIONS
- **No `prisma.globalPage.update` directly** — use an existing server write door.
- **No second sanitiser, no second storage helper, no second PDF renderer.** Reuse `cleanFileName`, `storage`, `generatePdfBlob`.
- **No overwriting an archived file, ever.** Versions only.
- **No bulk backfill.**
- **No unstamped reconstruction.**
- **No archiving on save.**
- **No lock bypass flag** — only the three named `ARCHIVE_FIELDS`.
- **Do not invent APIs.** Anything not pasted above, read from the file first.
