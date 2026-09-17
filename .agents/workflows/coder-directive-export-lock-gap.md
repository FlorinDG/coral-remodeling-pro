# CORAL — CODER DIRECTIVE — `LOCK-1…4` · the export lock seals the envelope, not the letter — Planner 2026-09-16

**🛑 PROMOTION BLOCKER.** Found on item 3 of the staging pass. Four defects, **one chain**, and the end of the chain is:

> **A document was sent to the accountant containing a value the database had refused to store.**

---

## THE CHAIN — each link is individually defensible; together they lie to the accountant

Florin edited `2026-55` (already `accountantExportedAt = true`, verified **boolean** `true`): article name, quantity, VAT regime.

```
1. vatRegime (a PROPERTY)     → checkExportLock refuses. Server returns success:false.   ✅ correct
2. store.ts:545               → silently retries with backoff. No toast, no error.       ❌ D2
   The UI keeps the optimistic value, so the edit LOOKS applied.
3. article + quantity (BLOCKS) → never checked at all. Written.                          ❌ D1
4. useExportCSV               → builds the CSV from `filteredPages` — the CLIENT STORE,  ❌ D3
   which still holds the value the server REFUSED in step 1.
5. …and stamps accountantExportedAt on every row it just exported.                       ❌ D4
```

**Confirmed by observation, not inference:** after a reload the VAT regime **reverted** (proving the lock fired) while the article name and quantity **persisted** (proving blocks are unprotected) — and **a CSV exported today still carries yesterday's refused edit** (proving the export reads local state).

---

## `LOCK-1` · 🟥 THE LOCK DOES NOT COVER `blocks` — and that is where the invoice actually is

```ts
checkExportLock(existingPage.properties, page.properties, relationPropertyIds)
//               ^^^^^^^^^^ properties only. `blocks` is never passed.
```
`saveGlobalPage` then writes `finalBlocks = page.blocks` with **no check whatsoever**.

**Invoice line items are `blocks`.** `ClientInvoiceEngine:285` — `calculateInvoiceTotals(blocks, { vatIncluded, vatRegime })`. Article, quantity, unit price: all of it.

So the lock protects `status`, `invoiceDate`, `client`, `totalIncVat`, the flag itself — **and leaves the content of the invoice editable.** *The envelope is sealed; the letter inside can be rewritten.* That is the inverse of the requirement: the reason to freeze a filed record is that the figures the accountant filed must still be the figures in the system.

- [ ] **`checkExportLock` takes `blocks` as well as `properties`** and refuses **any** block change on an exported record.
- [ ] **No block-level exemption list.** `ARCHIVE_FIELDS` exists because attaching a file does not change what the invoice says. **Editing a line does.**
- [ ] Apply at **every** door that writes blocks — `saveGlobalPage`, `saveGlobalPagesBatch`, `updatePageServerFirst`. **Grep for `blocks:` in every `globalPage.update`/`upsert` and prove each is covered.**
- [ ] ⚠️ **`EXPORT-LOCK-CORE`'s tests passed on properties only.** They proved the lock does what it does, not that it covers what it must. **Extend `tests/export-lock.test.ts` with block cases**, including a line-item edit that must be refused.

## `LOCK-2` · 🟥 A REFUSED WRITE IS INVISIBLE TO THE USER

```js
// store.ts:545
} else {
    get()._incrementRetry(entry.pageId);
    // wait, retry with backoff, continue — forever
}
```
`success: false` — **including `[ExportLocked]`** — produces **no toast, no banner, no log the user can see.** The optimistic value stays on screen and the queue retries indefinitely.

**This is why Florin believed the edit worked.** A refusal on a legally-binding record is the single most important thing the app can say, and it says nothing. ERROR-SURFACING DIRECTIVE, on the path that most needs it.

- [ ] **Distinguish a REFUSAL from a transient failure.** A refusal is **permanent** — retrying an export-locked write forever is wasted work that can never succeed.
- [ ] On refusal: **dequeue**, **revert the optimistic value to the server's**, and **tell the user plainly** — *"This document has been sent to the accountant. Field X cannot be changed."*
- [ ] Transient failures keep the existing backoff. **Do not collapse the two.**
- [ ] 🛑 **Never leave a refused value sitting in the store.** That is what made `LOCK-3` possible.

## `LOCK-3` · 🟥 THE ACCOUNTANT EXPORT READS CLIENT STATE, NOT THE DATABASE

`useExportCSV` builds the file from **`filteredPages`** — the in-memory store. So it exported **a value the server had refused to persist.**

**A document sent to an accountant must be generated from what the database holds.** Not from a browser's optimistic copy, which may contain refused writes, unsynced edits, or stale rows.

- [ ] **The accountant export is generated SERVER-SIDE from the database.** The client requests it; it does not assemble it.
- [ ] `/api/financials/export` **already does this correctly** (`NotionGrid:690`) — server-side, takes `startDate`/`endDate`, returns a ZIP with PDFs, aborts and names `failedDocuments` on any unreadable one (`BLOB-4`). **That is the real accountant export. The CSV button is a second door beside it doing something different under a similar name.**
- [ ] **Resolve the two doors.** Either the CSV becomes a server-generated format offered by the same endpoint, or it stops being an accountant export and stops stamping. **Two exports with two behaviours and one name is the defect shape this whole pass exists to remove.** 🛑 **Which of the two — Florin decides.**
- [ ] Also: `KlantContact` exports as a raw UUID. Unusable by an accountant.

## `LOCK-4` · 🟥 THE CSV IGNORES SELECTION AND STAMPS ON DOWNLOAD

```js
link.click();                                    // trigger a browser download
if (isAccountant) {
    filteredPages.forEach(page => {              // then stamp — one write per row
        updatePageProperty(..., 'accountantExportedAt', true);
    });
}
```

- [ ] **It ignores the user's selection.** `useExportCSV` receives `filteredPages` and has no notion of selection; `selectedRowIds` exists in `NotionGrid:892` and is never passed. **Florin ticked 10 rows and 86 were exported and frozen.** *Automation is good, but the user remains the ultimate authority* — this overrules the user silently.
- [ ] **It has no period selector**, while the correct path requires one (*"Selecteer een periode"*).
- [ ] **It stamps after `link.click()`** — that is "a blob URL was created", not "the accountant has it". Cancel the download and the records are frozen anyway.
- [ ] **86 individual client writes, not a transaction.** Partial failure leaves a partial freeze. **The exact opposite of the all-or-nothing Florin required** — *"no playing around with legally binding documents."*
- [ ] **It stamped drafts.** `2026-109` — `opt-draft`, zero totals, no date — is now marked sent-to-accountant and frozen. **A draft is not a document anyone has been given.**
- [ ] **Stamping is server-side, in one transaction, after the artefact exists** — the `BLOB-4` ordering, which the ZIP path already honours.

---

## VERIFY
1. On an exported record, edit a **line item** → **refused**, with a visible message naming the document.
2. On an exported record, edit a **property** → refused, **visibly**. The optimistic value **reverts**; the queue does **not** retry forever.
3. Attach a file to an exported record → **still allowed** (`ARCHIVE_FIELDS`). Change a relation → **still allowed**.
4. Edit a **non**-exported record → works normally. *(The lock must not over-block.)*
5. Export for a period → the file's contents match a **fresh database read**, not the browser's state. **Make an edit that the lock refuses, then export: the refused value must NOT appear.**
6. Select 10 rows → **10 are exported and 10 are stamped.** Not 86.
7. Cancel the download → **nothing is stamped.**
8. A draft in range → **excluded**, or explicitly confirmed by the user. Never silently frozen.
9. `npm run test:compile` · full suite green, **including new block-level export-lock tests.**

## PROHIBITIONS
- **No export generated from client state.** Server reads the database.
- **No stamping before the artefact exists.**
- **No client-side stamping loop.** One server transaction.
- **No silent retry of a refusal.**
- **No block exemptions** on an exported record.
- **No weakening of `checkExportLock`** to make a test pass.

---

# 📋 PLAN REVIEW — Planner, 2026-09-16 · read before building

**The plan is sound and `Option A` is APPROVED**: `/api/financials/export` becomes the only accountant export and the only thing that stamps; `useExportCSV` becomes a plain data export that respects selection and stamps nothing. That removes the client-side stamping loop, the draft freezing and the selection override in one move.

**Four corrections. The first is a hold-the-build item.**

## 🔴 R1 · THE BLOCKS DIFF — `JSON.stringify` IS TOO BLUNT, AND `[]` IS AMBIGUOUS
```js
JSON.stringify(incomingBlocks) !== JSON.stringify(existingBlocks ?? [])
```

**(a) Over-blocking.** If blocks carry any volatile field — regenerated ids, timestamps, collapsed/UI state, or merely a different key order after a serialisation round-trip — **a save with no semantic change is refused.** The user changes nothing, is told the document is locked, and stops believing the lock. **VERIFY item 4 exists for this: the lock must not over-block.** A lock that cries wolf is disabled by the user, mentally if not in code.

**(b) 🛑 `undefined` vs `[]` — the one that can destroy data.**
If a page is ever saved while its blocks are not hydrated, `incomingBlocks` arrives as **`[]`**, which is **indistinguishable from "the user deleted every line."**
- On an **exported** record → a spurious refusal.
- On a **normal** record → `saveGlobalPage` already does `finalBlocks = page.blocks`, so **the invoice's lines are silently wiped.** That hazard exists today; this work must surface it, not inherit it.

**This is `LAZY-2`'s lesson one level down: not-loaded must be impossible to mistake for empty.**

**REQUIRED:**
- [ ] **`undefined` (omitted) and `[]` (emptied) must be distinguishable at the server door.** Omitted → skip the block check entirely. Never conflate them.
- [ ] **Compare semantic content, not a raw stringify** — the line fields that actually define the invoice. If a normalised comparison is not cheap, then at minimum:
- [ ] 🛑 **Never accept `[]` as a legitimate incoming value when the server holds blocks. STOP AND REPORT instead.** Deleting every line of an invoice is a real user action, but it must not be inferred from an absence.
- [ ] Add a test: **server has 3 blocks, incoming is `[]` on a NON-exported record** → must not silently wipe.

## 🟧 R2 · DRAFT EXCLUSION MUST BE REPORTED, NOT SILENT
Excluding `opt-draft` is correct. **Excluding it quietly is not.** `BLOB-4`'s principle is that the export never differs from what was asked without saying so.
- [ ] If drafts fall in the range, **tell the user**: *"3 conceptdocumenten in deze periode zijn niet opgenomen."* Before or with the export, never after.
- [ ] A silent omission from an accountant export is the same class of defect as a silent inclusion — **both make the file disagree with the user's belief about it.**

## 🟧 R3 · THE REFUSAL PATH MUST NOT COLLIDE WITH `OCC-13`
The store already has a conflict path that **adopts the server baseline while KEEPING the user's content**. The new refusal path adopts the server baseline and **DISCARDS** it. **Two nearly identical paths with opposite outcomes.**
- [ ] A refusal must be classified **before** any conflict handling, and must never fall through to it. Otherwise the user gets a **Sync Conflict dialog offering to re-apply a value the server has already rejected** — which is how `SEND-1` looked, and it would read as the same bug returning.
- [ ] Assert this in a test: an `EXPORT_LOCKED` response **never** dispatches `coral-sync-conflict`.

## 🟨 R4 · THE ERROR TEXT — ANSWERING THE OPEN QUESTION
**Yes, change it. `blocks` is an implementation word; it tells the user neither which document nor what they cannot change.**
- [ ] Use the UI's own vocabulary: **`factuurregels`** (or `artikellijnen`), never `blocks`.
- [ ] **Name the document**, not just the field:
  > *"Factuur 2026-55 is al naar de boekhouder verzonden. De factuurregels kunnen niet meer gewijzigd worden."*
- [ ] Same for properties: name the field **as the UI labels it**, not by property id (`vatRegime` → *"btw-regime"*).
- [ ] en/nl/fr/ro.

## ✅ APPROVED AS WRITTEN
`LOCK-1`'s coverage of all three doors · the `errorCode: 'EXPORT_LOCKED'` + `serverProperties`/`serverBlocks`/`serverUpdatedAt` response shape · dequeue-on-refusal with backoff retained only for transient failures · `selectedRowIds` passed through to `useExportCSV` · relation fields resolved to display titles instead of raw UUIDs · the five new export-lock test cases.

---

---

# `LOCK-6` · THE TENANT MUST BE ABLE TO RUN THE ACCOUNTANT EXPORT TOO — Planner 2026-09-17

**Florin, 2026-09-17:** *"There is an accountant user, I'll reset the password if I have to and login. But the tenant should also be able to perform the export, just in case."*

## THE GAP `Option A` LEFT — and it was missed in review
The two export buttons are **role-gated** in `NotionGrid.tsx`:
```js
:82    const isAccountant = session?.user?.role === 'ACCOUNTANT';
:755   {!isAccountant && ( <button onClick={handleExportCSV}>Export</button> )}
:766   {isAccountant  && ( …period picker… 📦 Boekhouder export ) }
```
**The owner sees ONLY the plain CSV. The server-side ZIP — PDFs, period picker, atomic stamping, `BLOB-4` all-or-nothing — renders only for a user whose role is `ACCOUNTANT`.**

`LOCK-3/4` correctly stopped the CSV from stamping. **The unintended consequence is that the tenant owner now has no accountant export at all.** *(Planner note: I reviewed and approved `Option A` without checking button visibility. The plan was right; the review was incomplete.)*

## THE FIX
- [x] **Show the period picker + `📦 Boekhouder export` to the tenant owner/admin as well as `ACCOUNTANT`.** Same component, same endpoint, same atomic stamping — **one implementation shown to two roles, never a second button.**
- [x] **The plain CSV stays** as a data-export utility for non-accountant roles: respects selection, stamps nothing. Unchanged by this item.
- [x] `/api/financials/export` must **authorise both roles** — and still refuse everyone else. **Do not loosen it to "any authenticated user."**
- [x] 🔴 **Record WHO ran the export.** Now that two roles can stamp records read-only, *"who froze these 92 records, and when"* must be answerable. Stamp an actor alongside `accountantExportedAt` — or write an `AuditLog` entry, since that table already exists. **An irreversible action performed by either of two people needs a name attached.**
- [x] The export is **unchanged in behaviour** whoever runs it: same period rules, same draft exclusion (`R2`), same abort-on-unreadable-document, same one-transaction stamping.

## VERIFY
1. Log in as **owner** → period picker and ZIP button are present; export completes; records stamp.
2. Log in as **ACCOUNTANT** → identical behaviour.
3. Log in as any other role → **neither** the picker nor the ZIP button; `/api/financials/export` refuses directly too.
4. After an export, the actor is recorded and retrievable.
5. The plain CSV still stamps **nothing**, for every role.

---

## NOTE — data repair is Florin's
`2026-55` on **staging** now holds edited line items against reverted totals; 86 staging records are stamped. **Staging is a Neon branch — production is untouched.** Florin has said he will repair by hand once the behaviour is correct. **The coder makes no data changes.**
