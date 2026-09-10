# CORAL — 🟥🟥 BLOB READS + ERROR SURFACING — comprehensive work order (Planner 2026-09-09)

**Supersedes and absorbs `coral-mail-dispatch-diagnostics.md`.** That spec found one bug; the sweep behind it found the same bug in three shapes, one of which quietly corrupts the accountant handover. Do this as one job — the pieces share a root and fixing them separately means touching the same files three times.

---

## THE ROOT

There is **no single sanctioned way to read a file back out of storage**. `StorageProvider` was built for `put` / `list` / `delete` / `get`(URL) — reading *bytes server-side* was added later, twice, in two different places, by two different authors, and a third caller improvised its own. Blobs are written **`access: 'private'`** (`lib/storage/index.ts` → `put()`), which means the URL from `list()` is **not fetchable without a token**. Two of the three implementations don't know that.

| # | Where | How it reads | Correct? | Consequence when it fails |
|---|---|---|---|---|
| 1 | `app/api/files/[...key]/route.ts:44` | `get(key, { token, access: 'private' })` → stream | ✅ **the reference** | 404 to the client, visible |
| 2 | `lib/storage/index.ts` → `read()` | `list()` + **unauthenticated** `fetch(blob.downloadUrl)` | ❌ **cannot work** | throws → ATT-3 aborts the send |
| 3 | `app/api/financials/export/route.ts:27` `fetchBlobFile()` | `get(key,{token,access:'private'})` → `streamToBuffer` | ✅ mechanism right | **returns `null` and the export continues** |

**#1 is right and already exists.** Everything below is making the other two agree with it, and making failure visible when it happens anyway.

---

## 🟥🟥 THE ONE THAT MATTERS MOST — the accountant export lies

`app/api/financials/export/route.ts:319-345` — the document loop:
```js
const fileData = await fetchBlobFile(receiptUrl);
if (fileData) {                       // ← no else. A failed read is simply skipped.
    pdfFolder?.file(fileName, fileData);
}
```
and then, unconditionally, at `:348-373`:
```js
props.accountantExportedAt = true;     // marked exported whether or not the PDF made it in
await prisma.globalPage.update({ … lastEditedBy: 'system:accountant-export' });
```

**A sales invoice or purchase invoice can be stamped `accountantExportedAt = true` while its PDF was never placed in the ZIP.** The record then says the accountant has it, the "no-op check" at `:350` skips it on every future export, and the document is never sent again. This is the ATT bug — *"you are told it went out; you are not told it went out incomplete"* — applied to the bookkeeping handover, with a **permanent** flag instead of a re-sendable email. Silent, self-concealing, and it degrades a legal record.

---

## ⚠️ PLAN REVIEW — CORRECTIONS BINDING ON THE CODER (Planner, 2026-09-10)

The submitted implementation plan is sound in shape and correct on BLOB-1, MAIL-1 and BLOB-5. **Five corrections, the first of which is a blocker.**

### C1 🟥🟥 BLOCKER — `receiptUrl` holds TWO different shapes. Strict abort on the raw value bricks the export.
The property is named `receiptUrl` but new writers store a **key**: `receiptUrl = result.key` (`peppol/inbox/route.ts:322`, `backfill-peppol/route.ts:175`, `PurchaseInvoiceEngine.tsx:171`). **Legacy records store a full URL.** Proof, three independent defensive call sites:
```js
src={page.properties.receiptUrl.startsWith('http') ? page.properties.receiptUrl : `/api/files/${…}`}   // PageModal.tsx:1284
if (filePath.startsWith('http')) { … }                                                                  // attachment-link.tsx:21,66
const finalUrl = url.startsWith('http') ? url : …                                                       // DocumentViewerCard.tsx:11
```
The UI has been quietly absorbing this for months. `storage.read()` takes a **key** — hand it an `https://…` value and it throws, and under BLOB-4 strict that **aborts the entire export, permanently, for any period containing one legacy record.** The export would go from silently lossy to totally unusable, and it would look like the hardening broke it.

**Required before BLOB-4 is written — `resolveDocumentKey(value)` in `lib/storage`:**
- `t_<tenantId>/…` → use as-is.
- starts with `/api/files/` → strip the prefix, use the remainder.
- starts with `http` → parse; if it is a Vercel Blob URL for this store, recover the pathname and use it; **if it cannot be resolved to a key, that record is a hard failure** and is reported by BLOB-4 like any other (it genuinely cannot be exported).
- Tenant assert survives normalisation: the resolved key **must** start with `t_<tenantId>/`.

**Also required:** run a **read-only census first** — count records in `db-invoices` + `db-expenses` whose `receiptUrl` is non-empty and does **not** start with `t_`. Report the number to Florin **before** shipping strict. If it is large, the legacy values need a backfill (its own item), not an abort. **Do not ship BLOB-4 strict against an unmeasured population.**

### C2 🟥 A record with **no** `receiptUrl` must NOT abort the export.
The plan says "if any receipt fails to read → abort". An expense that never had a scan attached is **not a failure** — the current `if (receiptUrl)` guard correctly skips it. Strict applies **only** to a `receiptUrl` that is *set* and *unreadable*. If the coder conflates the two, **every export aborts**. Whether a missing document should itself block a bookkeeping export is a **separate question for Florin** — do not fold it in.

### C3 🟧 The plan stamps in the wrong order — it re-creates the same lie in a smaller window.
Plan text: *"update `accountantExportedAt: true` for the exported records, build ZIP, and return it."* That stamps **before** the ZIP exists. If `zip.generateAsync()` or the response fails, records are stamped and Florin never received the file — the original bug, narrower. **Binding order:** read/resolve all → verify all → `const zipBuffer = await zip.generateAsync(...)` → **then** stamp → return. Wrap the stamps in a **single `prisma.$transaction`** so a partial stamp run cannot survive either.

### C4 🟧 `getStorageProvider()` does not exist.
`lib/storage/index.ts:114` exports a singleton: `export const storage = new BlobStorageProvider()`. Use `import { storage } from '@/lib/storage'` — the same import the send actions already use. As written the plan does not compile.

### C5 🟨 Write BLOB-4 on `storage.read()` directly; and don't double peak memory.
- BLOB-1 lands first, so BLOB-4 should call `storage.read()` from the start rather than being written against `fetchBlobFile` and rewritten in BLOB-2. BLOB-2 then reduces to deleting the dead local helpers.
- "Fetch all receipts in memory first" holds every buffer **plus** the assembled ZIP at peak. Instead: **add each document to the zip as it is read**, collect failures as you go, and abort before `generateAsync()` and before any stamp. Same all-or-nothing guarantee, roughly half the peak memory. This matters — invocation memory is already a live problem (MEM-3, 307 MB baseline).

### Accepted from the plan, no change
`ProjectDetailView.tsx:551` (`'Factuur aanmaken mislukt door een systeemfout.'`) added to MAIL-4 — correct, it was missed in the spec. HTTP **422** for the BLOB-4 abort — good; use 422 consistently, not 500. Per-item commits with ID tags on `develop` — correct.

---

## THE WORK

### Layer 1 — one way to read a blob

- [ ] **BLOB-1 · Fix `storage.read()`** 🟥 — `lib/storage/index.ts`. Replace the `list()` + `fetch` body with the same call the serving route uses:
  ```js
  async read(key: string): Promise<Buffer> {
      const result = await get(key, { token: this.token, access: 'private' });
      if (!result?.stream) throw new Error(`Blob not found or unreadable: ${key}`);
      return await streamToBuffer(result.stream);
  }
  ```
  Import `get` from `@vercel/blob` (already imported for `put`/`del`/`list`). Add a shared `streamToBuffer` helper here — **not** a fourth private copy.

- [ ] **BLOB-2 · `fetchBlobFile()` in the export route uses `storage.read()`** 🟧 — delete the local `fetchBlobFile` + `streamToBuffer` from `app/api/financials/export/route.ts` and call the abstraction. Its mechanism is correct, but a correct copy is still a copy; the next person to change the storage backend will miss it.

- [ ] **BLOB-3 · Close the door** 🟧 — after BLOB-1/2, **`lib/storage/**` is the only module permitted to import `@vercel/blob`**, with one documented exception: `app/api/files/[...key]/route.ts` streams rather than buffers and may keep its direct `get`. Add the rule as a comment at the top of `lib/storage/index.ts` and to the tenant/gating checklist in `pd.md`. *(Grep proves the current surface is exactly 3 files — keep it at 2.)*

### Layer 2 — failure must be visible

- [ ] **BLOB-4 · The export refuses to lie — STRICT / ALL-OR-NOTHING** 🟥🟥
  **DECIDED (Florin, 2026-09-09): strict. "No playing around with legally binding documents."** The partial-export-with-manifest option is **rejected** — do not implement it, do not offer it as a fallback, do not add a setting for it.

  **Read C1–C5 in PLAN REVIEW above first — C1 and C2 change what "a failure" means, and C3 changes the write order.**

  In `app/api/financials/export/route.ts`:
  1. **Resolve and read every document before anything is written or stamped** (per C5, add to the zip as you read rather than buffering everything twice). Collect failures rather than skipping them (`if (fileData)` with no `else` is the bug).
  2. **If any read fails → abort.** Return a non-2xx with the failing records listed by **id + title + record type**. No ZIP is returned.
  3. **Nothing is stamped on the failure path.** The `accountantExportedAt` writes must be **unreachable** unless every document is in hand — move them after the ZIP is fully assembled.
  4. The UI surfaces the named records so Florin can fix the source documents and re-run.

  **Sequencing is the whole fix: read-all → verify-all → build ZIP → stamp.** The current order (stamp inside the same pass that may have skipped a file) is what makes the lie possible. A half-finished bookkeeping handover must not be representable — either the accountant got the complete period or the export did not happen.

  **Idempotency:** a re-run after fixing the source must offer the previously-failed records again. Since nothing was stamped on the abort path, this falls out for free — but assert it in the verification, because the `// no-op check` at `:350` is precisely what would hide a regression here.

- [ ] **MAIL-1 · The mail error carries its own identity** 🟥 — `send-invoice.ts:101-104` and `send-quote.ts:101-104`:
  ```js
  } catch (err: any) {
      console.error("Failed to execute invoice mail dispatch:", err);
      const detail = err?.message || err?.cause?.message || err?.name || String(err);
      return { success: false, error: `[${err?.name ?? 'Error'}] ${detail}` };
  }
  ```
  This is why we cannot name today's failure: the toast prints `response.error` faithfully, and the server hands it a constant. **Ship this even if BLOB-1 turns out to be the whole cause** — the next mail failure will be a different one.

- [ ] **MAIL-4 · The four constant-string toasts** 🟨 — append the caught error at each:
  `ClientInvoiceEngine.tsx:865` (`'Verzenden mislukt.'`), `:1781` (PDF preview), `:1832` (PDF genereren), `ProjectDetailView.tsx:510` (`'Factuur aanmaken mislukt.'`). Keep the Dutch prefix, add `: ${detail}`. Per the ERROR-SURFACING DIRECTIVE in `pd.md`.

### Layer 3 — prove it

- [ ] **BLOB-5 · A test that would have caught this** 🟧 — `tests/storage-contract.test.ts`: assert that `StorageProvider.read` is reachable and that a **missing** key **throws** rather than returning empty/null. Pure contract test against a stub — no network, no token, consistent with the zero-dependency harness. The class of bug here is *"a read path that cannot succeed was never executed in a test"*.

## VERIFY
1. Invoice with two project files attached → **three** attachments arrive. (This re-runs the ATT-1/2/3 verification, which was never truly green — BLOB-1 is its missing half.)
2. Same on a quotation.
3. Bogus attachment key → the toast **names the file**; no mail is sent.
4a. Export a period containing a record with **no** `receiptUrl` at all → **completes normally**; that record is skipped, not treated as a failure (C2).
4b. Export a period containing a **legacy `http…`** `receiptUrl` → resolves to a key and is included (C1); only a genuinely unresolvable value fails.
4. Accountant export over a period containing a record with a broken `receiptUrl` → **no ZIP is produced**; the error names the record (id + title + type); **no record in that period is stamped** `accountantExportedAt` — check the DB, not just the response.
5. Fix that document, re-run → export completes, and the previously-failed record **is included** and only now stamped.
6. Export a clean period → completes as before; stamps applied only after the ZIP is fully assembled.
7. `grep -rn "from '@vercel/blob'" src` returns **2** files.
8. `tsc --noEmit` clean; 55 + new tests green.

## ORDER
**BLOB-0 (census, read-only) → BLOB-1 → MAIL-1 → BLOB-4 → BLOB-2/3 → BLOB-5 → MAIL-4.**
**BLOB-0 is new and gates BLOB-4:** count `receiptUrl` values not starting with `t_` and report to Florin (C1). Strict must not ship against an unmeasured legacy population.
BLOB-1 and MAIL-1 are small and unblock diagnosis of everything else. BLOB-4 is decided (strict) and unblocked.

## FOR FLORIN
- **Worth knowing now:** any invoice already stamped `accountantExportedAt = true` whose PDF silently failed is currently invisible and will never be re-offered. After BLOB-4 lands, a one-off query can list stamped records whose `receiptUrl` no longer reads, so the gap can be closed by hand. **Not urgent, but it should not be forgotten** — this is bookkeeping.
