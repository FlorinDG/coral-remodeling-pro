# CORAL — CODER DIRECTIVE — `BLOB-7` · a document cannot be replaced — Planner 2026-09-21

**Florin, 2026-09-21:** *"Fixing this invoice — cannot upload. No doc available. Recreated with download button in the meantime, can't upload — 'blob already exists' notification, still not in the UI."*

**Not specific to that invoice. Re-uploading a file with the same name to the same record fails, always, for every record type.**

---

## THE MECHANISM

```ts
// lib/storage/index.ts:143
async put(key, data, opts) {
    const result = await put(key, data, {
        access: 'private',
        token: this.token,
        contentType: opts?.contentType,
        addRandomSuffix: false     // ← our own keys
    });                            // ← and NO allowOverwrite
}
```
**Vercel Blob with `addRandomSuffix: false` throws `"This blob already exists"` on a second `put` to the same pathname unless `allowOverwrite: true` is passed. It is never passed** — `grep -rn "allowOverwrite" src` → **zero**.

```ts
// app/actions/files.ts:26 — the key is fully deterministic
const key = `t_${tenantId}/${recordType}/${finalRecordId}/${cleanFilename}`;
```
**Same record + same filename = same key = guaranteed collision.** So:
- Upload a document, then upload a corrected version of the same file → **fails.**
- A generated PDF already sits at that key *(Peppol inbox writes `t_…/purchase-invoice/{pageId}/{safeName}`)* → **a manual upload of the same name fails.**
- **Every "replace this document" action in the product is broken**, and has been.

---

## 🛑 THE FIX IS NOT `allowOverwrite: true`
Setting it globally would let **an archived, sent invoice PDF be silently replaced.** That breaks `DOC-ARCH-1`'s guarantee and the premise the export lock rests on — *the document the accountant received is the document that is stored.*

**Overwriting must be a decision the caller states, not a default.**

- [ ] **`storage.put(key, data, { overwrite?: boolean })`**, default **`false`**. Passed through to `allowOverwrite`.
- [ ] 🔴 **Archive writes pass `overwrite: false` explicitly** — `document-archive`, the Peppol inbox, `backfill-peppol`. **Never `true`. Not conditionally, not with a comment saying why it is fine.**
- [ ] **`uploadFileAction` passes `overwrite: true`** — a user attaching a document to their own record is replacing it on purpose.
- [ ] **A refused overwrite returns a named error**, not the provider's string. `BLOB-3`: the SDK's vocabulary must not reach the user.

## THE MESSAGE — *"blob already exists"* tells the user nothing
- [ ] **Say what happened and what to do:** *"Er is al een bestand met deze naam gekoppeld aan dit document. Vervang het, of hernoem het bestand."*
- [ ] **If the write is refused because the document is archived**, say that instead — it is a different situation with a different answer: *"Dit document is gearchiveerd en kan niet worden vervangen."*
- [ ] en/nl/fr/ro, through the catalogue.

## 🟧 AND THE SECOND HALF — *"still not in the UI"*
`uploadFileAction:30-33` catches the error and returns `{ success: false, error }`. **So the action behaves correctly.** What Florin saw is the caller not distinguishing *"upload refused"* from *"upload done, list stale"*.

- [ ] **Check every `uploadFileAction` caller** — `PageModal:1222`, `PurchaseInvoiceEngine:169`, `AiDocumentImportModal:59` — and confirm a `success: false` **stops, reports, and does not leave the UI implying the file is attached.**
- [ ] 🛑 **Report any caller that ignores the result.** ERROR-SURFACING DIRECTIVE — **that is the silent-failure shape, on the document path.**

## VERIFY
1. Upload `factuur.pdf` to a record, then upload a corrected `factuur.pdf` → **replaces it, one file listed.**
2. Repeat on a record whose document is **archived** → **refused, with the archive message**, and the original is byte-identical afterwards.
3. Upload a **differently named** file → both exist, both listed.
4. A refused upload → **the UI says so and does not show the file as attached.**
5. `grep -rn "allowOverwrite" src` → only inside `lib/storage`.
6. `npm run test:compile` · full suite green.

## PROHIBITIONS
- **No `allowOverwrite: true` as a default.**
- **No overwrite on an archive path**, ever.
- **No provider error string reaching the user.**
- **No caller treating a failed upload as a success.**

---

## 📌 IMMEDIATE WORKAROUND FOR FLORIN
**Rename the file before uploading** — `bigmat-haren-2026.pdf` instead of whatever collides. Different filename, different key, no collision. It attaches correctly and `receiptUrl` resolves.

*(The attachment you added works for reference, but the accountant export reads `receiptUrl`, not attachments — so the document needs to land there to defuse the trap.)*
