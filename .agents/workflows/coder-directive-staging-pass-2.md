# CORAL — CODER DIRECTIVE — staging pass findings, `release/2026-09-18` — Planner 2026-09-19

Florin ran §5 on the re-cut branch. **Most of it passed.** Four findings, in priority order. **`SP-1` is a merge blocker and it is the Planner's fault.**

## ✅ WHAT PASSED — do not touch these
- **Export lock refuses edits** (`LOCK-1…5`) — line items and properties both refused, visibly.
- **Invoice send** — no Sync Conflict (`SEND-1`), attachments arrive, the magic link opens the right page with the right data.
- **Accountant ZIP** — sales-invoice count correct; **the already-sent filter does its job** (`EXPDLG-1`).
- **Custom period is applied** to the export.
- Cold quote link · Cmd+K cold search · mobile task flow — **all pass.**
- Peppol deliberately deferred to production. **Florin's call, and a sound one:** *"I already have a big mess in the invoicing because of Peppol testing. I'd rather do this live and troubleshoot, to protect compliance."*

---

## 🛑 `SP-1` · THE EXPORT PERIOD FILTERS THE WORKING GRID — MERGE BLOCKER

> *"I notice that ALL 2025 sales invoices are gone from UI. I created and sent an invoice and it is not in the list visible. The export period choice filters the database actively. Removing it brings all items back in view."*

**Cause — `NotionGrid.tsx:617`, changed at the Planner's request in `SEL-1`:**
```js
const acctDateFilteredPages = showAccountantExport ? acctExportPeriodPages : sortedPages;
//                            ^^^^^^^^^^^^^^^^^^^ was isAccountant
```

🔻 **Planner error, owned.** I asked for this on 2026-09-18, reasoning *"the owner sees the period picker but the grid does not filter to the chosen period."* **I had it exactly backwards.** For an ACCOUNTANT — a read-only role that exists to pull a period — filtering the grid is right. For the **owner, who works in that grid all day**, the export period must never touch what they can see. **An export setting silently hiding a year of invoices from the working view is far worse than the cosmetic inconsistency I was fixing.**

**And `EXPDLG-1` has since made it moot**: the period now lives **inside the dialog**, so the grid has no business knowing about it at all.

- [ ] **Revert `:617` to `isAccountant`.** The owner's grid shows what the owner's filters and sorts say — nothing else.
- [ ] **The export-lock banner count** reads from the same variable; it must count the **visible** rows, not an export period.
- [ ] Check for any other use of `showAccountantExport` that changes what the owner *sees* rather than what they *can do*. **Visibility of a control ≠ filtering of data.**

## 🔴 `SP-2` · SENDING AN INVOICE DOES NOT SET THE INVOICE DATE

> *"Invoice date is not set automatically when it is sent. Due date problem is on older invoices — once I set invoice date, due date is calculated now."*

`grep -n "invoiceDate" src/app/actions/send-invoice.ts` → **nothing.** The send path writes `status` and `receiptUrl` and **never stamps a date.**

**Consequences, and they compound:**
- **A sent invoice with no date is invisible to the accountant export.** `route.ts:155` — `dateInRange` requires a date, so the document is silently outside every period. **It has been sent to a client and cannot be exported to the accountant.**
- The **due date cannot compute**, so payment terms do not apply.
- **A dated invoice is a legal requirement in Belgium.** *(Not legal advice — worth confirming — but the engineering conclusion is the same either way.)*

- [ ] **Stamp `invoiceDate` on successful send**, in the **same server write** as `status: 'opt-sent'` and `receiptUrl` (`SEND-1`'s door). One write, one authority.
- [ ] **Only if it is not already set** — a user-chosen date is never overwritten.
- [ ] **Both paths** — email and Peppol.
- [ ] Derive the **due date** from it using the record's payment terms, same rule as the manual path.
- [ ] 🛑 **REPORT, do not fix:** how many sent invoices (`status = opt-sent`) currently have **no `invoiceDate`**? Read-only count, per tenant. **Florin repairs data.**

## 🟧 `SP-3` · THE "WITHOUT DATE" COUNT IS WRONG, OR ITS LABEL IS

> *"Three are not taken because it says in the UI 'no date'. WRONG. They all have an invoice date. Three lack, indeed, an expiry date."*

`route.ts:144` — `getDocDate` reads `invoiceDate || date`. So either the 3 documents genuinely lack both **(likely `SP-2`'s doing, or expenses using a differently-named date field)**, or the count is measuring something else and the label is lying.

- [ ] **Identify the 3 records and report what fields they actually hold.** Do not guess.
- [ ] If they are **expenses** with a different date property, `getDocDate` is reading the wrong field for that database — **fix the field, not the label.**
- [ ] If the count is right, **the label must say which date is missing.** *"3 zonder factuurdatum"*, not *"zonder datum"*. **A wrong label on a legal export is a wrong export.**
- [ ] **No silent exclusion.** Whatever is left out is named, per `EXPDLG-1`.

## 🟨 `SP-4` · BORDEREAU AND PO CANNOT BE REACHED

> *"There is no way for me to create bordereau and PO."*

Both routes exist (`admin/projects-management/bordereau/[id]`, `po/[id]`) and render from the store. **There is no UI entry point** — the documents are only reachable by pasting a URL.

- [ ] **Report first:** was there ever an entry point, or was it never built? **Do not build one on assumption.**
- [ ] Not a merge blocker — it is unreachable on `main` too, so nothing regresses.

## 🟨 `SP-5` · THE PERIOD PICKER SITS OUTSIDE THE DIALOG — *deferred, Florin: "not now"*
The toolbar period picker and the dialog's own period are two controls for one thing. **Move the period entirely inside the dialog and remove it from the toolbar** — after `SP-1`, the toolbar copy has no remaining purpose.

## ℹ️ NOT A BUG — preview deployments share one database
> *"A task edit in the release UI propagates to develop."*

**Expected.** `DATABASE_URL` is scoped to **Preview**, so every preview deployment — `release/*` and `develop` alike — reads the same Neon `staging` branch. **Production is untouched**, which is what the split was for. Worth knowing while testing: two preview tabs are two windows onto one database.

---

## ORDER
**`SP-1` first** — it is a one-line revert and it blocks the merge. **`SP-2` next** — it is producing bad data right now on every send. `SP-3` is a report before a fix. `SP-4`/`SP-5` are after promotion.
