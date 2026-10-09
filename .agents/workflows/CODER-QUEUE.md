# CORAL — CODER QUEUE
**Current as of 2026-10-08.** Order: GRID-REPLACE-5 §7 → LOC-GRID-1 → DB-HEADER-1 M4 → R2-1-B M4 → **HR MVP close:** ✅ DEAD-HR-1 → ✅ LOC-HR-1 → ✅ HR-SERAPH-1 → EMP-PROFILE-1 → GRID-SURFACE-1 → **LOC-NEW-1**. This file is always the live queue — superseded items are removed, not renamed.
🛑 **The filename never carries a date.** `PLANNER-HANDOVER.md` §7 points here permanently.

**Work top to bottom. Each item is a separate commit set. Report after each.**
🔴 **Every item ends with `.agents/reports/<ITEM-ID>.md`, written per `coder-report-protocol.md`, committed last.** No report file = the item is not done.

## HOW WORK IS SPLIT NOW (Florin, 2026-09-30)
- **The Planner implements judgement-heavy and load-bearing items directly** (WorkHub, Gate 2, anything on hours or files).
- **The coder takes long, mechanical, well-specified items** under a HARD FENCE of files it may not touch.
- **Promotion:** during the WorkHub iteration phase the Planner promotes green commits to `main` (CI + Vercel preview green on the exact commit, no `prisma/`/package change in the range, rollback hash noted). **Ends when Florin says we are back to develop-only.**

---

🔴 **STANDING (Florin 2026-10-02) — read `coder-report-protocol.md` §3a and §3b before any item:**
**every new test needs a THROW PROOF** (break the real code, show the test fail, restore), and
**bending a directive is not progress** — a blocked step is STOPPED, never worked around.

## ✅ `WH-7` — the shift editor rebuilt — DONE, M4 accepted 2026-10-05 (legacy forms deleted)

## ✅ `R1-7-B1` — DONE, reviewed 2026-10-05 (STOP 1 decided: lib/data/identity emailOwner; 4 files moved by the Planner)
📄 `coder-directive-r1-7-b1.md` — notifications → calendar → tenant, one commit per module; each migrated file leaves
the R1-5 allowlist and lowers `CEILING` by the files removed, from its current value. STOP on any cross-tenant read. Report `.agents/reports/R1-7-B1.md`.

## 2 · `DB-HEADER-1` — one database header across the ERP — ✅ M3 ACCEPTED · 🟩 GO M4 (stop after M4)
📄 `coder-directive-db-header-1.md` + **`.agents/plans/DB-HEADER-1.md` § PLANNER REVIEW — M3 (C11 first: actions carry
busy / disabled + reason)**, then M4 = CRM & Projects. Report `.agents/reports/DB-HEADER-1-M4.md`. Push, STOP.

## 3 · `R2-1-B` — the remaining direct record writes onto the one door — ✅ M3 ACCEPTED · 🟩 GO M4 (stop after M4)
**Binding for M4** (plan § PLANNER REVIEW — M3 note + these):
1. ~~`scan/route.ts`: `checkDuplicateExpense` gets the SCOPED client~~ — DONE by the Planner 2026-10-08 (DUP-1:
   `lib/expense-dedup.ts` replaced by `lib/records/duplicates` + `lib/data/duplicates` on the scoped client). Skip.
2. `api/financials/export/route.ts` changed TODAY (VALIDATE-1 `unvalidated`, MAR-1 `ledgerAccountOf` in both row builders):
   work on current HEAD; move ONLY the `accountantExportedAt` stamp write onto `saveRecord` — the selection, the rows
   and the ledger column stay as they are (tests/accountant-export.test.ts must stay green unchanged).
3. Portal routes write through `portalScope(...)` (the portal's own tenant) — never the office session, never `platformDb`.
4. Every new test with a throw proof; report `.agents/reports/R2-1-B-M4.md`; push; STOP.
📄 `coder-directive-r2-1-b.md` — re-measure the census, every direct GlobalPage write → `saveRecord` / `deleteRecord`
on the caller's scoped door (session / system / portal), or justified in writing. Plan `.agents/plans/R2-1-B.md`, STOP.

## 4 · `LOC-GRID-1` — the new grid speaks the user's language — 🟩 GO (DB-HEADER-1 M3 reviewed; one milestone, stop)
📄 `coder-directive-loc-grid-1.md` — every visible string in `v2/NotionGridV2.tsx` + `v2/cells.tsx` → `Admin.grid.*`
in en/nl/fr/ro; strings only; `tests/i18n.test.ts` is the guard (throw proof). Report `.agents/reports/LOC-GRID-1.md`.

## 0 · `GRID-REPLACE-5` — ✅ M1–M4 ACCEPTED · 🟩 GO M5 (Florin 2026-10-07: "can he go to M5 and remove the old grid entirely?")
M5 = `npm uninstall react-datasheet-grid` (package.json + package-lock.json ONLY, nothing else in the commit), prove no
occurrence left in `src/`, `npm run build` green. Its own commit + `.agents/reports/GRID-REPLACE-5-M5.md`. 🛑 A package
change: **Florin pushes that range to main himself** — commit on develop, push develop, STOP and say so.
Then §7 (report only, `.agents/reports/GRID-REPLACE-5-S7.md`): the DSG behaviours users may rely on vs the new grid.

## ✅ `R2-5` — DONE WITH CORRECTIONS (review 2026-10-02, `MORNING-2026-10-02.md` §2)
Store tests accepted. 11 of 13 OCC tests tested a COPY of the merge loop (§3a) — removed on
`pending/occ-merge`, replaced by real tests of `lib/records/occ-merge.ts`. Leftover: the backoff-formula
test in `write-path-store.test.ts` also asserts a copy — fold into the next item that touches it.

## (was) 1 · `R2-5` — characterization tests for the write path (tests only)
📄 `coder-directive-r2-5-characterization.md` — pins OCC, field merge, single-flight, sync retry, dirty-page protection, persistence BEFORE R2 moves anything. `src/` is read-only.

✅ `LOC-SWEEP-1` — done 2026-10-01 (`03ec24c`, report accepted by the Planner; live on main).

🟦 **Taken by the Planner (2026-10-01), do NOT pick up:** `SCH-8` / `HR-TS-8` (series scope, manual-entry project select) — it shares files with the work-order fields (`coral-work-order-tabs.md`). ✅ Done by the Planner: `PROJ-SSOT-1` phase 1 (`9ef6a6d`), `TASK-CREW-1`.

## 2 · `FILES-GATE-1` → folds into `ENT` — 🟢 **Florin decided the model (2026-09-30)**
> *"roles are to be confined by their function. hr will not work with financials and vice versa … director, owner have full oversight, project manager to his own. all roles can be granted access to other modules/submodules … in the tenant app settings, gated, accessible to the owner role."*
- **Inside one tenant (the seraph has already scoped it), a role reaches only its FUNCTION by default:** HR → HR; bookkeeping → financials; project manager → **their own** projects; director + owner → everything.
- **The owner grants extra modules / submodules to a role** in tenant settings (owner-only, gated).
- **Files follow the module they belong to** — an invoice PDF is financials, a clock photo is HR. `crew-file-policy.ts` is the first instance; this generalises it.
- 🟨 Open: grants **per role** (Florin's words) vs the existing **per person** `User.moduleAccess` (Settings → Team) — see chat 2026-09-30.

## 3 · `GATE-2b` — crew self-service on shifts, tasks, attachments
`write-policy.ts` does not yet cover `shifts`, `shift-tasks`, `shift-attachments` (crew writes those legitimately: user-initiated shifts, task progress, uploads). Needs reach-on-parent — **rides with `R1-4`.**

---

---

## HR MVP CLOSE (Florin 2026-10-08: "i think this will close the MVP stage for HR module") — after R2-1-B M4, in this order
The Planner shipped the judgement half on 2026-10-08 (`3869b484..8cdfd8cd`): kernel `shift-status.ts` + `absence.ts`,
leave = TimeOffRequest, conflicts, timesheets grouping/period/stats/cache, the werkbon viewer, two cross-tenant holes
closed. 🛑 **Planner-only, do NOT touch:** `src/lib/kernel/**`, `src/lib/records/**`, `src/lib/data/**`,
`src/app/api/hr/[entity]/route.ts` (clock-in path — a defect stops a crew), `src/app/actions/timesheets.ts`,
`src/components/time-tracker/hooks/**`, `src/components/workhub/**`, anything under `prisma/` unless the item says so.
Each item: plan → STOP for review → build → report `.agents/reports/<ID>.md` → push develop → STOP.

### ✅ 5 · `DEAD-HR-1` — ACCEPTED 2026-10-08 (Planner review: no dangling import/route/href; manifest shortcut fixed; fence kept) — remove the HR code nothing reaches (deletions only)
Prove each unreachable FIRST (no import, no route link, no `href`), list the proof in the plan, STOP. Candidates (verify,
do not assume): `app/[locale]/workhub/schedule/page.tsx` + `components/time-tracker/pages/Schedule.tsx` (writes a status
the server now refuses, builds `new Date(\`${date}T${time}\`)`), `schedule/ScheduleCalendar.tsx`, `hooks/useProjects.ts`
(🛑 it is under hooks/ — list it, the Planner deletes it), `components/admin/UserManager.tsx` / `UserDetailView.tsx` /
`RoleManager.tsx`, `app/[locale]/admin/hr/time-tracker/{time-off,profile,performance,documents}` pages, the
`'projects': 'hrProject'` entity slug (retired by PROJ-SSOT-1 — Planner removes it from the route on your list).
If `UserDetailView` goes, `app/actions/hr-admin.ts` has no caller: delete it and take it off nothing (it is already
off the R1-5 list). Each removed raw importer leaves the eslint allowlist and lowers `CEILING`. tsc + lint + tests green.

### ✅ 6 · `LOC-HR-1` — ACCEPTED 2026-10-08 (Planner review: option VALUES unchanged, status/conflict logic untouched, tests green). Leftover for HR-SERAPH-1: `leave/page.tsx` dates still `toLocaleDateString('en-GB')` (English months; `createdAt` formatted on the UTC server) → business date + locale formatter — the HR module speaks the user's language (strings only)
Every visible string in `app/[locale]/admin/hr/**` (employees, leave, dashboard, timesheets, werkbon print page),
`components/time-tracker/components/admin/ScheduleManagement.tsx`, `schedule/**` (matrix, table, shift editor, the
`shift-status-ui.ts` LABELS → keys; the colours stay), `werkbon/WerkbonDocument.tsx`, and `config/tabs.ts` `hrTabs`
labels → `Hr.*` keys in en/nl/fr/ro (Dutch is today's wording; English proper; FR/RO first-pass, mark doubtful ones).
Dates shown through the existing formatters — no new `toLocaleDateString('en-US')`. NO logic change.
`tests/i18n.test.ts` is the guard (throw proof: drop one key, show it fail).

### 7 · `HR-SERAPH-1` — the HR read side onto the scoped client
Move to `scopeFromSession()` (seraph): `api/hr/timesheet-reports`, `api/hr/timesheet-export`, `api/hr/timesheet-rates`
(+ `undo`), `api/hr/audit-logs`, `api/hr/lib/team-scoping.ts`, `app/[locale]/admin/hr/page.tsx`,
`app/[locale]/admin/hr/leave/page.tsx`, `app/actions/hr-documents.ts`, `app/actions/hr-announcements.ts`.
Binding: (1) the holes this closes are the UNSCOPED lookups by id list — `user.findMany({ id: { in } })`,
`employee.findMany({ userId: { in } })` with no tenant: they become scoped; (2) a manual `tenantId` filter may stay as a
second wall, never be the only one; (3) behaviour identical — same rows, same JSON (the timesheet screen and its export
are what Florin checks); (4) one file = one commit, each leaves the allowlist and lowers `CEILING`; (5) a test per file
that a foreign-tenant id is not returned, with throw proof. STOP after the plan.

### 8 · `EMP-PROFILE-1` — the employee profile is stored, not kept in the browser
Today department, contract type, address, birth date and notes live in `localStorage` (`emp-profile-<id>`,
employees/page.tsx): personal data on one browser, invisible to the rest of the tenant, lost on another device.
Additive migration on `Employee`: `department String?`, `employmentType String?`, `address String?`,
`birthDate String?` ('YYYY-MM-DD', a calendar date — not DateTime), `notes String?`; `api/tenant/employees` (already
scoped) reads/writes them; the page drops `loadProfile`/`saveProfile`. Existing browser values are NOT migrated
(re-entered by hand — Florin: root to leaf). 🛑 A `prisma/` change: commit on develop, push develop, STOP —
**Florin runs the migration and pushes the range himself.**

### 9 · `GRID-SURFACE-1` — the scheduler's table view in the ONE grid (Florin 2026-10-08: "wrong table" → our grid)
Plan first, STOP. Split `v2/NotionGridV2.tsx` into a presentational surface (columns, rows, cell renderers, sort,
column resize — no store) and the store-bound grid that uses it (behaviour of every database screen unchanged). Then
`schedule/ScheduleTable.tsx` renders shifts through the surface: Datum · Tijd · Medewerker · Project · Adres · Rol ·
Status (the kernel status select as today, `in-progress` shown never chosen) · conflict mark; rows = the weeks the
matrix shows. After LOC-GRID-1 (same files). Throw-proof tests on the shift → row mapping.

### 10 · `LOC-NEW-1` — the screens of 2026-10-08/09 speak the user's language (strings only)
Hard-coded Dutch today: `components/admin/expenses/PurchaseLineSearch.tsx` (line search), `app/[locale]/admin/financials/
expenses/quotes/page.tsx`, the duplicate banner and the Naar-offertes / verdict texts in `PurchaseInvoiceEngine.tsx`,
`TicketCaptureModal.tsx`, `AiDocumentImportModal.tsx` (DUP-1 / QUOTE-IN-1 parts only), the store's toasts in
`components/admin/database/store.ts` (SYNC-STUCK-1 "kon niet bewaard worden"), `components/ui/DecimalInput.tsx` (none —
check), `lib/records/purchase-document.ts` labels (QUOTE_LABEL / TICKET_LABEL → keys read by the editor; the rule keeps
returning keys, the screen translates). → `Admin.*` keys in en/nl/fr/ro. 🛑 Do NOT touch `lib/records/**` logic, the
store's sync logic, `lib/data/**`, the scan route. Strings only; `tests/i18n.test.ts` guard with a throw proof.
Report `.agents/reports/LOC-NEW-1.md`, push develop, STOP.

## THEN, in order
`TD-4` tail *(5 grandfathered files)* · `KERN-8` · `R1-2`/`R1-3` → `R1-4`+`R1-5` · `ENT-1…24` · `WB-A…E` *(the werkbon — phasing awaits Florin)*.
Recorded, not queued: `WH-EXPORT-1` (worker timesheet export) · `erp-tasks` keeps its own 3-role list (Tasks entitlement) · `AUTH_SECRET` fallback in the unlock cookie · `locked['projects'] || 'db-1'` fail-open (R1-2) · partial unique index on open clock entries (Florin's migration, when wanted).

---

## ✅ LANDED 2026-09-29 / 30 — 🟨 = not yet verified by the Planner against its directive
| Item | Commit(s) | Notes |
|---|---|---|
| `HR-TS-6` edit pane local time | `8bed336` | ✅ |
| `HR-TS-1/2`, `-3`, `-5`, `-7` | `457f1a1` `9248788` `e87093f` `0d56eb9` | 🟨 |
| `TD-4` 36 → 5 · `WH-UI-1` §9 · `WHS-1` §1–4 | — | ✅ |
| `ERR-1` describeError, 49 sites | `ea8cfdb` … `de6ad3c` · report `cc20582` | ✅ verified (fence held) |
| `WHS-1b` clock never acts on unknown state | `f7659d3` | ✅ Planner |
| `RBAC-CE-1` seraph gaps · `GATE-2` one actor-reach authority + write policy | `b293961` `ebb27d6` `f54e0ae` | ✅ Planner · SUPERADMIN everywhere (Florin) |
| `CE-TIME-1` server stamps live clock-in / crew clock-out | `da6977f` | ✅ Planner |
| `WH-2` crew app: Time Off · legibility (iOS zoom-out root cause) · 1.2rem · cards · rails | `37e9036` `e16efb7` `285dd63` | ✅ Planner · in production |
| `WH-2` Shift Brief (address/phone/mail/notes/tasks/attachments + carousel) | `3676b22` | ✅ Planner |
| `WH-2` My hours · My tasks · Documents | `6dc1bf6` `fa14eec` `f8f2aa0` | ✅ Planner |
| `FILES-CREW-1` crew could list/delete/overwrite every tenant file; ERP dataset shipped to crew phones | `f8f2aa0` `3542abb` | ✅ Planner |

---

# 🛑 STANDING RULES
- **No migration is ever run by the coder.** Write it, report the file, stop.
- 🔴 **`pd.md` 5e: a schema change deploys only AFTER Florin has applied its migration.** Additive: database first. Destructive: code first.
- 🔴 **`pd.md` 5f: every directive's BLAST RADIUS is a file list. A file not on it is not touched.**
- **No timezone offset arithmetic. Anywhere.** Report asymmetries.
- **Never `prisma db push` / `migrate dev` against production / `--accept-data-loss`.**
- **Fix the definition, not the instance.**
- **A write is removed only in the commit that converts its last reader.**
- `test:compile` · `test:lint` · suite — exit 0 on every commit.

---

# 📋 NOT FOR THE CODER — design of record, do not build
📄 `coral-walkdown-werkbon-record.md`
**The werkbon becomes a signed, frozen, self-evidencing document.** All questions answered; phasing `WB-A` … `WB-E` awaits Florin's word.
🔴 **`WB-D` (the freeze) must not land after `WB-C` (signing).** The client's signature is the second approval door (Gate 2 walkdown §3).
