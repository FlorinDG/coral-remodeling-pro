---
description: CoralOS LIVE BOARD v2 — single source of truth for execution. Supersedes pro-hardening.md as the active tracker. Read AFTER pd.md.
---

# CoralOS — Live Board v2
> Reset 2026-06-04 from Florin's full "state of the union" walkthrough of the deployed app.
> **This file is now the active tracker.** `pro-hardening.md` is archived history (many items there were marked done but are shallow/broken in production — do NOT trust its statuses; THIS board is ground truth).
> North star: **FINANCIAL CORRECTNESS first.** Sequencing: **FOUNDATION-FIRST** (fix shared primitives that cause many symptoms before chasing individual symptoms).

---

## 🔒 EXECUTION PROTOCOL (binding — the trust reset)
1. **ONE workstream item at a time.** Complete it, STOP. No multi-item commits.
2. **Two-stage status, Florin gates.** Coder may reach `🟢 DONE — awaiting verify` (the furthest the coder goes). ONLY Florin sets `✅ VERIFIED`. **No new item starts until the current one is `✅ VERIFIED`.** Failed verify → `🟡 IN PROGRESS` → fix → resubmit.
3. **Commit naming = checksum.** One item = one commit: `<ITEM-ID>: <short imperative>` (e.g. `FIN-1: credit-note links by parentInvoiceId only`). Same ID on follow-ups. No creative/bundled names. So `git log --oneline` is glanceable against this board.
4. **Measure, don't claim.** "Done" = you tested the real behavior on the deploy and stated HOW in feedback. "Implemented" ≠ done.
5. **Regression rule.** An increment must not break anything previously `✅ VERIFIED`. If it does → it's not done.
6. **Branch:** all work on `develop`; promote to `main` + tag only at version checkpoints (below).

---

## 🟢 HAPPY PATH (the spine — every increment must move a real user one verified step further)
FREE tier → first paid:
**signup → company data correct & stable → create invoice (engine usable) → send invoice (email works) → log expense (scan stores file) → receive Peppol (SMP live) → accountant export.**
Financial correctness underpins the middle of this path → that's why FIN workstream goes first.

---

## 🔢 VERSION CHECKPOINTS (a tag = "everything up to here works, nothing prior regressed")
- **v0.1 — Financial core correct.** FIN workstream fully ✅: invoice/credit-note correctness, numbering, sent-doc edit-lock exemption, credited %. The money is trustworthy.
- **v0.2 — Database foundation solid.** GRID workstream ✅: editing no longer janky, flyouts edge-safe, detail-views removed app-wide, selects searchable. The app stops feeling half-broken.
- **v0.3 — Real editor + blocks.** EDITOR workstream ✅: Notion-grade rich text everywhere it's needed.
- **v0.4 — Free-tier happy path.** Capture→invoice→send→expense→receive→export all verified on mobile + desktop. **Launchable free tier.**
- **v0.5+ — Modules deepened** (Projects, Inbox, Calendar, Files, Sales) + localization complete.
- Patch bumps (v0.x.N) for the cosmetic/isolated tail.

---

## 🔧 CURRENT DEBUG QUEUE (Florin's live batch — run in THIS order, one-at-a-time, ✅-gated)
1. **FIN-8** — CN-from-invoice 404 (add `credit-notes/[id]` route). DO FIRST: one file, and it unblocks *viewing* the created CN so FIN-7 can be verified.
2. **FIN-7** — CN gets invoice number (measure why `getNextDocumentNumber('creditnote')` fails; remove the invoice-number fallback). Financial/legal correctness.
3. **QUOTE-7** — Save-to-Library writes discount into the supplier column (map to canonical `prop-art-*` ids). Stops silent data corruption.
— **PROFILE-2** (profile reset) is owned by Florin's direct debug pointing, tracked separately — NOT in this coder queue unless reassigned.

# ════════════════ THE BOARD ════════════════
# Workstreams ordered by execution priority. Each item: ID · state · one-line.
# States: ⬜ not-built · 🟧 shallow (exists, inadequate) · 🩹 broken · 🟢 done-awaiting-verify · ✅ verified

## FIN — Financial correctness (v0.1) — DO FIRST
- **FIN-1** ✅ VERIFIED (Florin deploy + Planner code-confirm 2026-06-04): substring fallback REMOVED; credit notes link by explicit `parentInvoiceId` ONLY (CN creation stamps `parentInvoiceId:[id]`). Wrong-attach corruption closed. (was B3)
- **FIN-1b** ✅ VERIFIED (Florin, 2026-06-04 — real credit note CN-2026-006 correct: right parent link, numbering, VAT/totals). Phrasing leak ("Creditnota voor" on FR doc) is NOT a FIN bug → routed to LOCALE-2 (stored-text-in-wrong-language root fix). Purge of string-guessing of document identity:
  1. ✅ (code-confirmed) Remove `CN-` title fallback from `isCreditNote` in `ClientInvoiceEngine.tsx` (line 315 now `docType === 'opt-credit-note'` only) — ALSO do/confirm it in `InvoicePDFTemplate.tsx`.
  2. `create-invoice.ts` — accept explicit `type` param instead of inferring from title prefix. (verify landed)
  3. Guard auto-status: never overwrite `opt-paid` or `opt-uncollectible` with a credited status.
  4. ✅ (code-confirmed) `creditedTotal` uses `Math.abs()` (line 225) for negative-stored credit totals.
  - Florin verify: create a credit note + an invoice titled with "CN" coincidentally → detection still correct; a paid/uncollectible invoice does NOT get flipped to credited; credited totals correct sign. (Florin-scoped cleanup 2026-06-04)
- **FIN-2** 🟡 REOPENED by FIN-7. CN numbering looked ✅ on a manually-created CN (CN-2026-006), BUT the CN-from-invoice BUTTON path falls back to the invoice number → the `creditnote` numbering action is failing on the deploy. See **FIN-7**. `DocType` incl. `'creditnote'` w/ DB-derived sequence (next-document-number.ts:126) is correct in code; the failure is environmental. ⏳ Florin still verify the INVOICE-import-no-skip half (import keeps own number, counter doesn't advance). (was B4 + CN numbering)
- **FIN-3** 🟢 DONE — awaiting Florin verify. Lock model = `isLocked` + snapshot (legal immutability); project/offerte relations sit outside locked content. **Florin verify:** open a SENT/locked invoice → project + offerte STILL editable, line items/amounts LOCKED. (was Q2 part4)
- **FIN-4** ✅ VERIFIED (Planner code-confirm): persists `creditedPercent` as `"xx% — €x.xxx,xx"` (nl-BE), guards terminal statuses (paid/uncollectible) from credited overwrite. (also completes FIN-1b item 3.) ⏳ Florin glance grid display.
- **FIN-5** 🟢 DONE — awaiting Florin verify (status-select hit target in engine; click-test on deploy).
- **FIN-6** VAT/totals consolidation correct (one calculator, optional-line VAT bug, rounding matches Peppol UBL). VERIFY it actually landed (was L5 — committed but unverified).
- **FIN-7** 🩹 **CN-from-invoice button mints the INVOICE number as the credit-note number — numbering scheme ignored.** ROOT CAUSE (measured): `ClientInvoiceEngine.tsx` `handleCreateCreditNote` (~line 346-350):
  ```
  const numResult = await getNextDocumentNumber('creditnote');
  const cnNumber = numResult.success && numResult.number ? numResult.number : `CN-${invoiceNum}`;
  ```
  The proper path calls the right action, BUT the **fallback embeds the invoice number** (`CN-${invoiceNum}`). Florin sees the invoice number → the fallback is FIRING → `getNextDocumentNumber('creditnote')` is returning `success:false` in the deploy. The action itself (`next-document-number.ts:126`) looks correct, so the failure is environmental — **MEASURE it (per /pd): surface `numResult.error`** (console/toast). Strong hypothesis to check first: `creditnote*` columns missing / migration not applied on the deploy → the Prisma `select:{creditnotePrefix:true,…}` throws → caught → success:false. (Invoice/quotation numbering work because their columns exist.) **FIX:** (1) confirm `creditnote*` columns exist + migration ran; (2) **remove the invoice-number fallback entirely** — a credit note must NEVER inherit the invoice's number. On numbering failure: abort creation with a clear error (don't mint a wrong number). This supersedes FIN-2's optimistic "CN numbering ✅" — that was verified on a manually-created CN, not this button path.
- **FIN-8** 🩹 **CN-from-invoice 404s after creation (document IS created, shows in Credit Notes table).** ROOT CAUSE (confirmed): `handleCreateCreditNote` does `router.push('/admin/financials/income/credit-notes/${id}')` but **that dynamic route doesn't exist** — `income/credit-notes/` has only `page.tsx` (the table), no `[id]/`. **FIX:** create `src/app/[locale]/admin/financials/income/credit-notes/[id]/page.tsx` mirroring `income/invoices/[id]/page.tsx` exactly: `return <ClientInvoiceEngine id={id} locale={locale} />;` (CNs live in `db-invoices`; the engine already handles `isCreditNote`). Verify the Credit Notes table row links also target this route. (FIN-7 + FIN-8 are both in `handleCreateCreditNote` but are distinct fixes → two commits.)

## GRID — Database/editing foundation (v0.2) — fixes MANY symptoms at once
- **GRID-1** 🟢 DONE — awaiting Florin verify (optimized NotionGrid column memoization and stabilized key to eliminate remounts and cell edit dropouts).
- **GRID-2** 🩹 Name-property "open" button only works when the cell is NOT selected; if selected, button dead. Fix.
- **GRID-3** 🩹 Column resize: header resizes but cells don't follow until a horizontal scroll forces recalc. Fix width propagation.
- **GRID-4** Remove the elastic/rubber-band drag animation at view edges — just stop at the edge.
- **GRID-5** 🩹 Flyouts/dropdowns clipped at screen edge everywhere. ONE fix: edge-aware positioning (measure viewport, flip orientation when overflowing). Applies app-wide (billing card, selects, menus). (was U2 + general)
- **GRID-6** Remove the standalone **details view** app-wide; standardize on the Notion-style **modal** only. Keep open-button + drag-handle actions. Applies to: Sales, Contacts, Suppliers, Articles, Receipts, Bestek. (ONE decision, ~6 modules)
- **GRID-7** Reusable **searchable select** component (type-to-filter). Used by: Quotations (project, client, pipeline), Projects, Financials. Build once.
- **GRID-8** Filter/sort UX: sort sometimes not applied (fix); filter must adapt to property TYPE — select property → show its options with is/is-not; "contains" → text field. Not always a text input.
- **GRID-9** Add `@` (Notion-style) to insert dates and reminders in text/cells.

## SCHEMA — Data integrity cleanup (v0.1) — SPLIT: stop the cause, THEN clean (data-safe)
> 🩸 Root cause (Planner, code-read 2026-06-04): duplicate "Quotation"/"Contacts" DBs + stray "New Workspace"/"New Database" entries are MANUFACTURED by ≥5 uncoordinated create paths: `provisionLockedDatabases` (intended), `pages.ts:75`, `peppol/inbox/route.ts:215`, `scan/route.ts:417` (each "create-if-missing"), and `DatabaseClone.tsx:713` + `dynamic-db/page.tsx:24` (`createDatabase('New Database'…)`). When `getLockedDbId` resolves a tenant's system-DB id inconsistently (bare `db-quotations` vs `db-quotations-<suffix>`), multiple paths each create → duplicates. **A pure data-clean would re-spawn duplicates immediately. Must stop the cause FIRST.**

- **SCHEMA-1a** ✅ VERIFIED (Planner code-confirm 2026-06-04, commit `SCHEMA-1a`): all 3 server create-paths (`pages.ts`, `peppol/inbox`, `scan`) now resolve canonical id via `getLockedDbId` BEFORE the existence check → create-only-if-missing on the SAME id (no cross-path duplication). `dynamic-db` button confirmed safe (UUID id, not system prefix). DatabaseClone uses `resolveDbId`. Tap is SHUT. · minor note: `findUnique`-then-create (not atomic upsert) → tiny theoretical race on a brand-new tenant's first DB; acceptable, suspect here if a fresh dup ever appears.
- **SCHEMA-1b** 🟢 EXECUTED LIVE 2026-06-04 — ✅ PAGE COUNTS CONSERVED both tenants (Murgu 4→4; Coral 1250→1250). Provisioned db-payments-in/out-cmneyas2, migrated 86 payment pages intact, deleted 7 empty dups + the migrated-empty sources, Murgu 1-ticket migrated. No data loss. **⏳ Florin's ONLY remaining check: open Coral → Received Payments → confirm the 86 are VISIBLE (proves the lockedDbIds repoint resolves; conserved-in-DB ≠ visible-in-UI). If blank → lockedDbIds pointer gap (data safe, snapshot covers). Then ✅.** **Dry-run report (data-safe, merge of EXISTING duplicates):**
  - Build an auditable script: per tenant, group GlobalDatabases by system-type; for each type with >1, pick canonical (the one in `lockedDbIds`, else the one with most pages), **MIGRATE all GlobalPages from duplicates into the canonical**, repoint references (`lockedDbIds`, any `databaseId` FKs), THEN trash the now-empty duplicates. Remove "New Workspace"/"New Database" garbage ONLY if confirmed empty/orphaned.
  - **MANDATORY: dry-run mode that REPORTS what it would merge/delete/migrate (counts + ids) WITHOUT executing. Florin reviews the report, THEN authorizes the live run.** Never blind-delete a DB that holds pages.
  - Acceptance: each tenant has exactly ONE of each system DB; ZERO page loss (page counts before == after, in the canonical); garbage removed; dry-run report archived in feedback.
- **SCHEMA-2** Status/option IDs canonical + consistent across engine and DB views (partially touched; verify).

> ⚠️ Data-mutating on live tenants. 1a is safe (code only). 1b MUST dry-run → Florin-approve → execute. Two separate one-at-a-time items.

## EDITOR — Real rich-text + Notion blocks (v0.3)
- **EDITOR-1** 🟧 The "rich text" line in quotation/financial engines is shallow (too few options). Replace with a PROPER rich-text editor: headings, body, font size, **B/I/U/S**, link block, table block, image block, + standard Notion blocks. (Quotations, Bestek pricing notes, Journal all depend on this — was J1/L3, done shallow.)
- **EDITOR-2** Add ALL Notion block types available, app-wide where blocks are used.
- **EDITOR-3** Journal entries must each be a DISTINCT journal entry (not merged); auto-linked to the host record. (was J1 link part)

## QUOTE — Quotation module (v0.3/0.4)
- **QUOTE-1** Project select → searchable (GRID-7).
- **QUOTE-2** Client select → searchable (GRID-7).
- **QUOTE-3** Sales-pipeline backlink select.
- **QUOTE-4** Offertes-connection select displays **number + subject**.
- **QUOTE-5** Rich-text editor in engine (EDITOR-1).
- **QUOTE-6** Research payment modalities → a setup field modeled like the profitability card (staged %/exact amounts; wire to vorderingstaten). (was Q5)
- **QUOTE-7** 🩹 **Save-to-Library writes the shop discount into the SUPPLIER column, not the discount column** (margin + other fields fine). ROOT CAUSE (measured — recurring substring-matching failure class): `SaveToLibraryModal.tsx` `findPropId` (line 28-30) returns the first property whose name *contains* any alias. Discount aliases `['korting','remise','discount','disc','lever']` (line 37) — `'lever'` is a substring of **"Leverancier"** (the supplier relation prop `prop-art-supplier`, which is defined BEFORE `prop-art-remise`/"Discount" in the articles schema, `mockData.ts:775` vs `:778`). So `propMap.discount` resolves to `prop-art-supplier` → on save (line 78) the discount % is written into the supplier relation (corrupting it) and the real Discount prop never gets it. Margin works because `['marge','margin']` can't false-positive. **FUNDAMENTAL FIX (use schema identity, not string guessing):** `db-articles` is a SYSTEM db with canonical prop ids — map directly to them (`prop-art-bruto`, `prop-art-remise`, `prop-art-margin`, `prop-art-verkoop`, `prop-art-unit`, `prop-art-type`), exactly as the apply path already does (`FinancialRowRenderer.tsx:222-224`). Only fall back to name-matching for non-system custom DBs, and when doing so use EXACT name equality — never partial/substring — and drop the dangerous `'lever'`/`'disc'` aliases. **Also check the invoices twin** `src/components/admin/invoices/SaveToLibraryModal.tsx` for the same poisoned alias list. **Verify:** save an article with a discount → Discount column gets it, Leverancier relation untouched; reload into a quote → discount applies.

## PROJ — Projects module (v0.4/0.5)
- **PROJ-1** ALL | Operations | Administration | Business Dev → move to TAB BAR as **filtered views** of the same DB (NOT new databases).
- **PROJ-2** Keep only ONE timeline (de-duplicate).
- **PROJ-3** Detail view layout: financial analysis → top of side section; financial documents → middle section.
- **PROJ-4** Detail view: linked financial documents + connected relations cards → middle section, side-by-side, ABOVE tasks card.
- **PROJ-5** 🩹 Billing card select flyout clipped by card edge (GRID-5 should fix; verify here).
- **PROJ-6** Detail view: connected-tasks → a Notion-style DB VIEW of connected tasks (replace connected-records section).
- **PROJ-7** Vorderingstaten = linkable documents from a DB; create the vorderingstaten DB if missing; add as a tab in Projects.
- **PROJ-8** 🩹 Kanban: card doesn't open the project → flyout with editable+savable property list.
- **PROJ-9** 🩹 Kanban: three-dot menu doesn't work.
- **PROJ-10** Kanban view-settings: choose visible card properties, editable in place.
- **PROJ-11** 🩹 Timeline: drag handles hard to grab (name field extends to card edge).
- **PROJ-12** Timeline becomes the **PLANNING TIMELINE** tab in Projects.
- **PROJ-13** Timeline: add tasks to projects + render task entries on timeline; project = dropdown, tasks visible in expanded project (Notion task/subtask timeline style).

## FILES — Storage: MIGRATE Google Drive → Vercel Blob (v0.2)
**DECISION (Florin, 2026-06-06):** App is the only door to files (no external Drive browsing). **Full migration to Vercel Blob.**
**✅ PREREQS SATISFIED (Florin, 2026-06-06):** PRIVATE Blob store created (`store_yhNt9hDHlPfEV3x6`); `BLOB_READ_WRITE_TOKEN` provisioned in Vercel env (values NOT in repo — env only). `BLOB_WEBHOOK_PUBLIC_KEY` available but webhooks are OPTIONAL/later (not a v0.2 dep). Stream is unblocked to run AFTER v0.1 is tagged. Drive's folder model was the root of "creates a folder per item / saved-but-not-findable / scattered roots" — Blob is flat key-based storage, which structurally eliminates that entire bug class. The old FILES-1/2/3 (Drive-folder patches) are RETIRED by this decision — do NOT work them.
**SCOPE BOUNDARY — read before touching anything:** Migrate ONLY the file-STORAGE surface. Google **Calendar** + **Gmail** OAuth STAY (they are not storage). Do NOT remove `api/calendar/*`, `api/email/connect/google/*`, `googleToken.ts`, or shared Google OAuth token infra. Storage surface to migrate: `lib/google-drive.ts`, the file-storage parts of `lib/google-drive-oauth.ts`, `api/drive/*` (init, route, upload, list, callback, auth, migrate-f4), `components/admin/file-manager/*`, `components/admin/drive/DriveFileExplorer.tsx`, `components/admin/expenses/TicketCaptureModal.tsx`, `useScheduleAttachments`, `useProjectAttachments`, `components/portal/DocumentManager.tsx`. **Coder: measure-before-deduce (/pd) — grep the real call sites first; this list is the planner's map, not gospel.**

**NORTH-STAR DESIGN — adapter seam (the general measure, not 49 detail edits):** Introduce ONE storage interface and route everything through it. The Drive→Blob swap then lives at a single boundary.

- **FILES-ISO** 🔒 **TENANT ISOLATION — read FIRST, it shapes FILES-0.** The `t_{tenantId}/` prefix is ORGANIZATION, not a security boundary. Two non-negotiables: **(1) Use a PRIVATE Blob store** (`access: 'private'`, Vercel Private Storage — built for invoices/contracts; public-beta Feb 2026). Public blobs get an unguessable-but-public URL that bypasses all auth if leaked — unacceptable for an ERP. **Store privacy is fixed at store creation and CANNOT be changed after — Florin must create the store as private.** Private blobs have no public URL; retrieve only via SDK `get()`. **(2) Records store the KEY, never a URL.** Serve files through an authenticated route `GET /api/files/[...key]` that (a) resolves session tenantId, (b) asserts the requested key startsWith `t_{sessionTenantId}/` — reject otherwise (this is the identity-check that replaces Drive's `isFolderOwnedByTenant` parent-walk; one prefix assert, fail-closed), (c) streams the blob. EVERY `get/list/delete` derives tenantId from session and refuses keys outside the prefix — NEVER trust a client-supplied key. (Recurring failure class: validate identity, not the string.)
- **FILES-0** Define `StorageProvider` interface in `src/lib/storage/index.ts`: `put(key, data, opts) → {key, url}`, `get(key) → stream/url`, `delete(key)`, `list(prefix) → entries`. Add `BlobStorageProvider` (`@vercel/blob`, **`access: 'private'`**) as the implementation. `put` returns the KEY (persist that on the record); reads go through the FILES-ISO serving route, not a stored public URL. **Key scheme (tenant-isolated, flat):** `t_{tenantId}/{recordType}/{recordId}/{filename}` (e.g. `t_ten-gar163.../receipt/pg-abc/aldi-2026-06.pdf`). No folder objects — the prefix IS the namespace. **EXCEPTION — projects allow subfolders:** project keys may carry an arbitrary nested subpath: `t_{tenantId}/project/{recordId}/{subpath…}/{filename}` (e.g. `…/project/pg-7/permits/2026/bouwvergunning.pdf`). Blob keys are plain slash-delimited strings, so subfolders cost nothing at storage level — they are VIRTUAL, derived from key segments, never stored folder objects (so the "folder-per-item" bug still can't recur). Env: `BLOB_READ_WRITE_TOKEN` (Florin provisions in Vercel). **This task ships the seam with NO behavior change yet — provider exists, nothing calls it.**
- **FILES-1** Repoint **WRITE** paths to the seam: `api/drive/upload`, `TicketCaptureModal` (receipt capture), attachment hooks. Each upload calls `storage.put(...)` and **persists the returned `{key, url}` onto the owning record** (page property / attachment row) — this is what kills "saved-but-not-findable": the file is found by its stored key on the record, never by walking a folder tree.
- **FILES-2** Repoint **READ/LIST/DELETE** paths: `FileManager*`, `DriveFileExplorer`, `DocumentManager`, `api/drive/list|route`. In-app explorer renders from `storage.list(prefix)` + record-stored keys. Delete via `storage.delete(key)`. **Explorer behavior by record type:** all record types render a FLAT file list per record (no manual folders — keeps the no-mismanage guarantee). **Projects are the exception:** the project node renders its key subpaths as navigable virtual subfolders and supports create-folder / rename / move-within-project (a "folder" is created implicitly by uploading to/naming a new subpath — no folder object is persisted). Move = re-key (copy to new key, update record ref, delete old). Subfolder UI is scoped to `recordType === 'project'` ONLY.
- **FILES-3** 🩸 **DATA MIGRATION (treat like SCHEMA-1b — dry-run first, manifest, reversible).** Walk every tenant's existing Drive files, copy each into Blob under the new key scheme, update the owning record's stored URL/key. **Dry-run output:** per-tenant file count + total bytes + sample key mapping; Florin reviews before live. **Idempotent + resumable** (re-running skips already-copied keys). Keep Drive originals untouched until Florin verifies (Drive = the parachute; no snapshot needed since we don't delete source).
- **FILES-4** After Florin verifies files render in-app post-migration: retire dead Drive storage code (`api/drive/*` storage routes, `google-drive.ts` storage fns) — **but keep Calendar/Gmail OAuth.** Leave Drive files in place as cold backup (don't delete remote).
- **FILES-5** Quotations engine — **image insert must open the new in-app file explorer (picker mode), not a native dialog.** Current: `src/components/admin/quotations/FinancialRowRenderer.tsx:493` does `const url = prompt('Image URL:'); document.execCommand('insertImage', false, url)`. Replace the `prompt()` with the FILES explorer opened as a **picker**: user picks/uploads an image → explorer returns the file's served key/URL (via the FILES-ISO auth route) → insert that into the rich-text block. **Kill the native `prompt()` system window entirely.** Same native-dialog smell sits at `:496` (`prompt('Link URL:')`) — out of scope for "image" but flag it: ideally both move to in-app UI, not browser prompts. (Depends on FILES-0/1/2 explorer existing.)
- **SCAN-4 depends on FILES-0/1** — storing the original receipt file uses the same seam + key scheme.

## SCAN — Receipts/expense capture (v0.4, free-tier core)
- **SCAN-1** 🩹 Manually adding a ticket from the scan modal produces NO result in the DB. Fix.
- **SCAN-2** 🩹 Adding a PDF for scan opens it in Acrobat but the modal doesn't process it. Fix PDF handling in the modal.
- **SCAN-3** Receipts: remove details view (GRID-6); in the modal — remove journal entry, ADD project-connection property, and replace the journal section with an **image/file component** that displays the receipt (img/pdf/etc.). (was B2 + Florin financials)
- **SCAN-4** Store the ORIGINAL receipt file (not just extracted data) — see SCAN-3 display depends on it. (was B2 core)

## SEND — Send invoice/quote (v0.4, happy-path)
- **SEND-1** 🩹 "Send to client" says no email though email exists — resolve email column by TYPE not name (locale-fragile). (was B5)

## PEPPOL — Receive (v0.4, happy-path; partly provider-side)
- **PEPPOL-2** ✅ RESOLVED 2026-06-04 (e-invoice.be support reply): Coral = approved RESELLER. Credits at ORG level, post-pay NET-10, **no per-tenant activation/fee, no per-tenant credit pack**. Reseller-created tenants are billed via the org account → **NOT subject to the pre-paid "blocked until payment" gate → they can RECEIVE from go-live.** 1 credit per Peppol doc BOTH directions; tiered €0.18→€0.05 by total monthly volume across all tenants. Per-tenant balance via `GET https://api.e-invoice.be/api/stats`. (was E1 — closed.)
- **PEPPOL-1** 🟢→ provider-handled: the `smp_registration: false` gate was the regular pre-paid model, which does NOT apply to reseller tenants. e-invoice.be is re-triggering Coral's SMP server-side. **Florin action:** confirm to support that Coral is the tenant to push first (done on ticket). **Verify:** once they confirm, (a) Coral shows `smp_registration: true`, (b) a real inbound doc lands in Coral's inbox, (c) a freshly reseller-provisioned test tenant comes up receive-enabled with NO gate. Then ✅. (Downgraded from blocker — structural cause resolved by provider.)

## INBOX — Email (v0.5)
- **INBOX-1** 🩹 Inbox doesn't download mail though accounts are connected. Fix sync.
- **INBOX-2** All-inboxes unified view.
- **INBOX-3** Link a mail to sales/quote/project; a mail linked to a sales-pipeline item propagates to the connected quotation and onward to the project (cascade linking).

## CAL — Calendar (v0.5)
- **CAL-1** 🩹 UI wrong — white/invisible buttons.
- **CAL-2** 🩹 "Failed to create event" — connection error; fix.
- **CAL-3** Local calendar aggregates everything in the ERP that has dates; assignable to external calendars; manual event creation in external calendars.
- **CAL-4** ⬜ External calendar connection (Google/Outlook/Apple) missing from settings — add.
- **CAL-5** Mobile calendar unusable — responsive toolbar, sensible mobile view, reachable actions. (was M5)

## TASKS — Tasks module (v0.5)
- **TASKS-1** 🩹 Side panel doesn't scroll; if window short, Save button unreachable. Fix scroll/sticky save.
- **TASKS-2** Make Tasks a mobile-first module.

## CONTACTS / SUPPLIERS / LIBRARY (v0.2, mostly GRID-6)
- **CS-1** Contacts: remove details view (GRID-6).
- **CS-2** Suppliers: remove details view (GRID-6).
- **CS-3** Articles: remove details view (GRID-6).
- **CS-4** Bestek details: remove stats + journal cards; connected-properties → **connected articles**; add a **pricing table** (a miniature quotations engine); properties stay in left column + populate DB.

## MOBILE — (cross-cutting, v0.4)
- **MOB-1** 🚦 FREE mobile lands in WORKHUB (subdomain/PWA-scope) — must stay in `/m`. (was M4, launch blocker)
- **MOB-2** Overall mobile optimization pass (legibility/layout verified, not just committed). (M2 committed — re-verify)
- **MOB-3** MOBILE OPTIMISATION OVERALL — every module usable on phone. (umbrella; individual modules tagged mobile-first as reached)

## LOCALE — Localization (FOUNDATION, not string-sweep) (v0.3/0.5)
> Principle (Florin): fix the MECHANISM, not each leaked string. The "Creditnota voor 2026-19" on a French doc is not a typo — it's a SYSTEMIC fault: text isn't bound to the document's language, and some text is HARDCODED/stored in one language. Fix foundations.
- **LOCALE-1** 🩸 ROOT FIX — document/engine text must resolve via `t(key, documentLanguage)`, never hardcoded literals. Measured scale: ~43 hardcoded NL strings across `ClientInvoiceEngine.tsx` (~30) + `ClientQuotationEngine.tsx` (~13), plus untranslated module/option names. Route all of them through the i18n layer keyed by the DOCUMENT's language (NL/FR/EN/RO). One mechanism; the strings follow.
- **LOCALE-2** 🩸 STORED-TEXT FIX — generated text frozen in one language. Concrete: `ClientInvoiceEngine.tsx:344` stores `betreft: \`Creditnota voor ${invoiceNum}\`` (Dutch) into the record → renders on a French credit note as-is forever. Fix: store such generated references as a KEY/structured ref resolved at render time in the document language (or generate in the doc language). Audit for other frozen-language stored fields (status labels, auto-betreft, etc.).
- **LOCALE-3** Coverage sweep — AFTER the mechanism (1+2) is solid: ensure NL/FR/EN/RO keys exist for every document/engine string + module/option names. This is the only "detail" pass, and only because there's no choice — keys must exist for the mechanism to resolve. Do NOT hand-fix individual strings before 1+2.
- **LOCALE-4** Leaked variable keys (e.g. `Admin.nav.pages.manualTicket` showing raw) = missing keys surfaced by the mechanism; fixed as part of LOCALE-3 coverage. (was CROSS-2)

## PROFILE — Tenant data stability (v0.1, underpins documents)
- **PROFILE-1** 🟢 DONE — awaiting Florin verify. **Two fixes:** (A) **Stale profile:** engines copied tenant into local state via `useEffect([])` — never re-consumed fresh context. Fixed: deps → `[tenant]`; `TenantContext` upgraded to state + `refreshTenant()`; all 8 settings pages call `refreshTenant()` after save; `AdminLayout` syncs branding via `tenantProfileUpdated` event. RSC read path (Prisma direct) was never cached — `revalidatePath`/`router.refresh()` always produced fresh data; the bug was downstream consumption. (B) **Language triple-write desync:** `environmentLanguage` was only written to JWT in-memory on `updateSession()` — not persisted to DB until next full JWT refresh; `NEXT_LOCALE` cookie relied on middleware round-trip. Fixed: auth.ts now persists `environmentLanguage` to DB immediately; both desktop + mobile set `NEXT_LOCALE` cookie client-side before navigating; Google OAuth first-login fallback changed from hardcoded `"fr"` to `"nl"` (matches routing.ts default). **Florin verify:** (1) change brand color → engine shows new color without reload; (2) switch interface language on desktop → switch device → same language persists; (3) mobile language switch navigates to correct locale path.

- **PROFILE-2** 🩸 **PROFILE RESET — branding + document numbering wiped (Florin, ongoing debug 2026-06).** ROOT CAUSE (measured, not stale-load — that was PROFILE-1): the company-info settings widgets **initialize local state to hardcoded fake defaults, then PUT those fields unconditionally on save.** Two offenders, same bug class:
  - `src/app/[locale]/admin/settings/company-info/page.tsx` — `profile` state seeds `invoicePrefix:'INV'`, `invoiceNextNumber:1`, `quotation*`, `creditnote*`, `documentTemplate:'t1'` (lines ~123-162); hydrates from `tenant` only in `useEffect([tenant])` (~168-211); `handleSave`→`proceedWithSave(profile)` sends the WHOLE `profile` via `JSON.stringify(dataToSave)` (~227-230).
  - `src/components/admin/settings/DocumentTemplatesModule.tsx` — seeds `primaryColor:'#d35400'`, `selectedTemplate:'t1'`, `documentLanguage:'nl'` (~160-162); hydrates in `useEffect([tenant])` (~177-187); `handleSaveSettings` PUTs `brandColor/documentTemplate/documentMode/logoUrl/stationeryUrl` unconditionally (~189-202).
  - **The reset:** if `tenant` (TenantContext) is null/stale at save, or a save fires pre-hydration, the route writes any field present in body (`if (field in body)`), so the DEFAULTS overwrite real DB values → numbering snaps to INV/1, color to #d35400, template to t1. `refreshTenant()` (PROFILE-1) only fixed display, not this write-back.
  **FUNDAMENTAL FIX (general measure — make it structurally impossible to persist a value you never loaded):**
  1. **No fake defaults in saved state.** Initialize the persisted fields to `null`/undefined (a "not loaded" sentinel), NOT to `'INV'`/`1`/`'#d35400'`/`'t1'`. Apply display defaults ONLY at render (`value={profile.invoicePrefix ?? 'INV'}`), never into the object that gets PUT.
  2. **Gate save on hydration.** Block save + disable the Save button until `tenant` has loaded (`if (!tenant) return;` / `disabled={!tenant || saving}`). A save can never run against un-hydrated state.
  3. **Send only owned + loaded fields.** Each widget PUTs ONLY the fields it owns and that were actually hydrated (skip any still-null). Drop `documentTemplate`/`documentLanguage` from company-info's payload — `DocumentTemplatesModule` owns those; overlapping writers is the smell. (Mirror the tight-partial pattern the other 5 settings pages already use.)
  **VERIFY (Florin):** set numbering to e.g. INV2026/00045 + a brand color + template; hard-reload; reopen company-info BEFORE it fully loads and immediately hit save → values must NOT reset; cross-check DB. Regression-check: editing only the company name must not touch numbering/branding.

## SETTINGS / ADMIN (v0.5)
- **SET-1** Schema-edit screen back button → goes to global schema; should be navigational (back in history to where the user came from).
- **SET-2** Improve tenant management, especially licence management.
- **SET-3** Properly separate Superadmin / ERP config / Tenant settings.
- **SET-4** Website CMS must include BOTH the Coral Enterprises front site CMS and the ERP front CMS.

## CROSS — App-wide / general (mixed)
- **CROSS-1** Replace black crash screen with a themed screen. (note: pd.md said done — VERIFY; Florin still lists it)
- **CROSS-2** 🩹 Untranslated variable keys leak to UI (e.g. `Admin.nav.pages.manualTicket`). Fix missing i18n keys.
- **CROSS-3** Sales→Offerte→Project cascade: info populates one level up so the Project eventually holds everything. (the data-flow backbone; design carefully)
- **CROSS-4** 📊 Peppol credit tracking + unit-economics observability (FULL SPEC below). (was O1; now grounded in confirmed reseller pricing.)
- **CROSS-5** OpenAI import engine audit — regression check + accuracy (was OAI-1/L2). VERIFY current state first.
- **CROSS-6** My personal Notion module + anything in pro-hardening.md not yet done (sweep at the end).

## DASH — Dashboard
- **DASH-1** ⬜ Future development (deferred — not now).

---

## 📋 CARRIED FORWARD from pro-hardening.md (status per git log; VERIFY, don't trust)
- Committed but UNVERIFIED (treat as shallow until Florin confirms): F1/F1-FIX (drive isolation), F2 (peppol health), F3/B/C (inbox shape), P8 (billing UI), P10 (trial parked), L2/L4 (extraction/decimal), L5 (totals), Q1 (authoring), Q2 (project P&L), M2/M3 (mobile/accountant), legal-texts, rich-text-block.
- **The `B1-B5, M4, M5` were shipped in ONE batched commit** — high regression risk, explicitly distrusted; folded into FIN/GRID/SCAN/SEND/MOB/CAL above for proper one-at-a-time re-verification.
- Genuinely NOT shipped: Q4 (OGM/payment matching), Q5 (→ QUOTE-6), U1 (sidebar sync), J1 (→ EDITOR), S1 (site visit), O1 (→ CROSS-4), E1 (→ PEPPOL-2).

---

## ▶️ PROPOSED FIRST INCREMENTS (foundation-first, financial-correctness north star)
Run strictly one-at-a-time, each ✅-gated by Florin:
1. **SCHEMA-1a** (stop duplicate creation — code only, safe) → then **SCHEMA-1b** (data-safe merge, dry-run → Florin-approve → execute). 
2. **FIN-1** — credit-note↔invoice correctness (financial integrity, highest).
3. **FIN-2** — numbering.
4. **FIN-3** — sent-doc edit-lock exemption (project/offerte editable).
5. **GRID-1** — fix core cell editing (unblocks daily use everywhere).
→ then GRID-5/6/7 (flyouts, kill detail-views, searchable selects) which clear large swaths.
**v0.1 tag** after FIN-1..6 + SCHEMA-1 + PROFILE-1 verified.

---

# ════════════ DETAILED TASK SPECS ════════════

## CROSS-4 — 📊 Peppol credit tracking + unit-economics observability (reseller model)
**State:** ⬜ not-built · `develop` · target v0.5 (but the METER part should land early — see note)
**Why:** As a reseller, Coral pays e-invoice.be **1 credit per Peppol document, both directions**, tiered **€0.18 → €0.05** by total monthly volume across ALL tenants, billed org-level post-pay NET-10. Coral must track this precisely — both to control cost and to price/gate FREE vs PRO on real numbers, not guesses. (Confirmed by e-invoice.be support 2026-06-04.)

### CONFIRMED FACTS (from support reply — use these, don't re-derive)
- Org-level credits, post-pay NET-10. No per-tenant activation/fee/pack.
- **1 credit per Peppol doc, SENT and RECEIVED** (inbound counts).
- Tiered rate by combined monthly volume (Appendix 1 of reseller agreement): **€0.18 → €0.05**. Exact breakpoints come from the agreement — Florin to supply the full grid; until then use a CONFIGURABLE tier table, not magic numbers.
- Per-tenant balance/stats endpoint: **`GET https://api.e-invoice.be/api/stats`** (per-tenant via Admin API). Use it as the source of truth to reconcile against our own counts.

### Build — meter → attribute → reconcile → display
1. **Meter every Peppol document at the source** (the one place that already increments `peppolSentThisMonth`/`peppolReceivedThisMonth` in `plan-limits.ts` — extend it). For each sent AND received doc, record an event: `{ tenantId, direction (sent/received), docType, timestamp, creditsConsumed: 1 }`. Persist as history (a `peppol_credit_events` table or equivalent), not just a rolling counter — we need monthly history + audit.
2. **Cost attribution via the tier table.** A configurable `PEPPOL_CREDIT_TIERS` (volume breakpoints → €/credit). Compute cost = credits × current tier rate, where the tier is determined by **total org volume this month across all tenants combined** (not per-tenant). Show both our cost and (later) what we charge the tenant, to derive margin.
3. **Reconcile against `GET /api/stats`.** Periodically (or on the dashboard's refresh) pull e-invoice.be's authoritative per-tenant stats and compare to our internal counts. Flag drift (our count vs theirs) — protects against silent over/under-billing. e-invoice.be is the billing source of truth; our meter is for real-time visibility + attribution.
4. **Superadmin "Peppol Credits & Cost" dashboard** (extend the existing superadmin Peppol-health panel / TenantsGrid): 
   - Org-wide: total credits this month (sent/received split), current tier rate, projected monthly cost, NET-10 due.
   - Per-tenant: credits consumed (sent/received), attributed cost, last reconcile vs `/api/stats`, drift flag.
   - FREE-tier aggregate: total monthly credit cost of the entire free base (THE number that proves free-forever scales — free users cost ~5 sent + up to 20 received = up to ~25 credits/mo each).
5. **Threshold alerts:** a tenant with abnormal credit burn (e.g. a free tenant far above expected); org approaching a tier breakpoint (so Florin sees volume-discount kick in); reconcile drift beyond tolerance.
6. **Feed pricing/gating:** expose these numbers so FREE caps / PRO overage / pricing are evidence-based. FREE caps already exist (5 sent / 20 received) — surface "this free user cost €X this month" against them.

### Premises to measure (Rule 2)
- `[MEASURED ✅]` `plan-limits.ts` already counts peppol sent/received per tenant per month — extend, don't duplicate.
- `[CONFIRMED ✅]` pricing model + `/api/stats` endpoint (support reply).
- `[ASSUMED ❓]` exact tier breakpoints — Florin/agreement Appendix 1. Configurable table until supplied.
- `[ASSUMED ❓]` `GET /api/stats` response shape — probe it (org key) before building the reconcile.

### Acceptance criteria
- Every Peppol send/receive recorded as a credit event with tenant + direction + timestamp (history retained).
- Cost computed via configurable tier table on combined org volume.
- Superadmin dashboard: org + per-tenant + FREE-aggregate credits/cost; reconcile vs `/api/stats` with drift flag.
- Alerts for abnormal burn / tier breakpoint / drift.
- Tier rates + breakpoints are config, not literals. `tsc`+`lint` green.

### Note on timing
The **meter** (step 1) should land EARLY (cheap, and you want history accumulating from now). The dashboard/reconcile can follow. Split into CROSS-4a (meter) and CROSS-4b (dashboard/reconcile) if running strict one-at-a-time.

### 🤖 AI FEEDBACK
- measured (plan-limits counters; /api/stats shape):
- credit-event meter (sent+received, history):
- tier table + org-volume cost calc:
- reconcile vs /api/stats + drift flag:
- superadmin dashboard (org/per-tenant/FREE-aggregate):
- alerts:
- premise updates appended to pd.md? (y/n):

---

*Board reset by Planner 2026-06-04 from Florin's state-of-the-union. pd.md rules inherited. Execution protocol above is binding.*
