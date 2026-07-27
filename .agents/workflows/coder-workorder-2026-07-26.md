# CODER WORK ORDER — 2026-07-26 (Planner → coder handoff)

Sequenced, coder-ready. **Work top-down.** Each batch is a commit boundary; verify before starting the next. Detail lives in the linked specs — this file is the order of operations and the acceptance bar.

## GROUND RULES (apply to every batch)
1. **One concern per commit.** The working tree was previously mixed (OCC + DnD together) — never again; you can't revert one without the other.
2. **Clean tree before starting.** Commit/stash unrelated work first.
3. **Neon snapshot before promoting** anything that writes live data (`pd.md` PRE-PROMOTION BACKUP CHECKPOINT): Batches 1, 3, 5.
4. **Never widen a guard to silence a symptom.** OCC exists because real data was lost. Narrow *what counts* as a conflict; never narrow the protection.
5. **Absence of state ≠ never configured.** (Root cause of Batch 4.) Don't infer user intent from missing data during hydration.
6. `npm run test:compile` + `npm run test:lint` green before every commit.

---

# BATCH 1 — UNBLOCK DAILY WORK 🟥🟥 (Florin is blocked right now)

### 1.1 · OCC-6 — new quotes conflict on first edit
**File:** `src/app/actions/global-databases.ts`
**Bug:** `:226-228` — `if (page.dirtyBaseBlocks) { hasHardConflict = true; }` declares a conflict whenever the client edited blocks and `updatedAt` moved **for any reason**, without checking whether the **server's blocks** changed. `:210-213` doesn't even `select` blocks. Since every quote/invoice edit is a blocks edit, any property-only server write poisons the record. `quote-service.ts:99` does exactly that right after creation ⇒ **100% reproducible on every new quote.**
**Fix (no migration):**
1. Add `blocks: true` to the `select` at `:212`.
2. Compute a deterministic hash of `existingPage.blocks` (stable stringify; sort keys).
3. Add **`baseBlocksHash`** to `Page` (`types.ts`), set in `store.ts` wherever `baseUpdatedAt` is refreshed (`:259`) and on hydrate.
4. Replace the guard with: `hasHardConflict = page.dirtyBaseBlocks && serverBlocksHash !== page.baseBlocksHash`. If server blocks are untouched → **apply client blocks**, merge properties as normal.
5. Back-compat: `baseBlocksHash` absent ⇒ fall back to current conservative behaviour.
**Verify:** create a new quote → edit lines freely, zero dialogs. Cron/export touches a record → editing still merges. Two sessions editing blocks on the same record → real conflict still raised.

### 1.2 · DND-FIX-1 — duplicated lines, over-flattening, cursor offset
Detail: `coral-engine-dnd.md` → DND-FIX-1. **Data is not corrupted; this is render + measurement.**
- **A. Rows must render only themselves.** `QuotationRow.tsx` still renders children at `:430`, `:603`, `:828`. The engine renders the flattened list (`ClientQuotationEngine.tsx:1013`) which already includes them ⇒ everything nested draws twice. For each site: if it sat **inside a removed `<Droppable>`** ⇒ delete it; if it was inline (non-draggable subcomponent UI) ⇒ keep it and exclude that level from flattening. **KEEP** `calculateBlockTotal` recursion at `:110/115/117`.
- **B. `flattenBlocks` must only descend into containers.** `lib/block-tree-dnd.ts:49` recurses unconditionally ⇒ leaf-line subcomponents get promoted to top-level rows. Recurse only into `section | subsection | post`.
- **C. Indentation is on the wrong node.** `SortableQuotationRow.tsx:35,40` applies `marginLeft` on the same element as `setNodeRef` + `CSS.Transform` ⇒ skewed pointer offset. Move indentation to an **inner** wrapper.
- **D. Land the guards NOW** (before any dragging on a real document): block-count + id-set invariants on every drop (abort + toast on failure, never persist), and `_pushUndo` in `updatePageBlocks` (`store.ts:1270-1293`, currently missing).
**Verify:** each line appears exactly once at correct indent; subcomponents stay inside their line; handle sits under the cursor with the container scrolled mid-way; **T1: 10 same-parent reorders leave the document total identical.**

---

# BATCH 2 — FINISH THE OCC CLUSTER 🟧
- **2.1 OCC-2b** — finish system-write tagging. Only `cron-overdue` + `accountant-export` are tagged. Still untagged: `quote-service.ts` (**both sites — this one causes 1.1**), `payment-plan-service.ts`, `actions/pages.ts`, `actions/tasks.ts`, `api/scan`, `api/peppol/inbox`, `api/admin/backfill-peppol`, `accept-quote`, `accept-invoice`, `stripe/webhook`, `cron/vat-backfill`, `api/portals/*`, `schema-cleanup`.
- **2.2 OCC-4b** — dialog copy + recovery. Header still says *"Someone else edited this page"* (false in every observed case). Use the `lastEditedBy` origin already returned (`global-databases.ts:264`): system ⇒ *"This record changed in the background (<origin>)"*; human ⇒ *"<user> edited this record."* **Localize NL/FR/EN.** Add per-field **Keep mine / Keep theirs** — Download Backup + Reload is still a dead-end.
- **2.3 OCC-5** — skip no-op cron writes (write only when the computed value differs).
- ✅ Already landed, do not redo: OCC-1 (`store.ts:415`), OCC-2 (partial), OCC-7 (`DERIVED_PROPERTY_KEYS`, `:237/245`).

---

# BATCH 3 — WORKFORCE IDENTITY 🟥 (blocks all timesheet reporting)
Detail: `coral-timesheet-reporting.md` → prerequisite section.
**One defect, four occurrences.** `ClockEntry.userId` / `ScheduledShift.userId` must contractually hold the **User id**, but employee ids are being written:
- `ManualEntryModal.tsx:88` — `<SelectItem value={emp.id}>` ⇒ table shows an 8-char id fragment (resolver at `api/hr/[entity]:270-280` keys `empMap` by `e.userId`, so it matches neither map).
- `CreateShiftForm.tsx:799-808` — `worker.id` ⇒ **shifts never appear in WorkHub** (`MySchedule.tsx:153` filters `s.userId === user?.id`).
- Previously: timesheets `employeeMap`, "System" attribution.
**Fix:** (1) shared **`resolveWorkerUserId()`** + inverse, used by every writer and reader — no more local patches. (2) Both forms submit the **User id**. (3) **Backfill** existing rows (employee id → user id): dry-run + count + backup first, reversible.
**Then:** `WORKHUB-SNAKE-CASE-LEGACY` — **153** snake_case leftovers in `components/time-tracker/` (`shift_start`, `shift_end`, `clock_entry_id`, `user_id`, `full_name`) read `undefined` against Prisma's camelCase (e.g. `MySchedule.tsx:77` renders blank times). Sweep + type the DTOs so it can't recur.
**Verify:** create a shift for a worker → appears in their WorkHub with correct times → clock-in links to it → timesheet row shows their **name**.

---

# BATCH 4 — DATABASE COLUMN VISIBILITY 🟧
- **4.1 DB-VIEW-PROPSTATE-NOT-STICKING** — root cause `DatabaseClone.tsx:727-738`: an **every-mount default-seeding effect** re-hides `betreft`, `source`, `peppolDocId` on Purchase Invoices. Its `!hasState` guard infers "never seeded" from "no state present", which is false **while hydration is in flight** ⇒ it re-hides *and persists* over the user's unhide. **Same pattern at `:740-751` (`db-articles`) and `:753-770` (`db-1`) — fix all three.**
  **Fix:** (a) gate seeding on hydration complete (`persist.hasHydrated()` + server-hydration flag); (b) record seeding as an explicit **one-time marker/version** on the database, not re-derived every mount; (c) never seed after the user has touched that view's properties.
- **4.2** — **`syncDb` failure path.** `store.ts:10-12` is fire-and-forget with `.catch(console.error)`; a failed save of a user-visible setting is completely silent. Surface a toast / sync-status like the page-sync path. *(Independent defect — do it regardless.)*
- **4.3 DB-SCHEMA-VISIBILITY-BTN** (feature) — add an eye / eye-off toggle **next to the trash icon** in the schema editor (`DbPropertiesPanel.tsx`), calling the **same** `updateViewPropertyState(dbId, viewId, propId, {hidden})`. No second visibility mechanism. Applies to the **active view**; label it so scope is unambiguous.
**Verify:** unhide `betreft` on Purchase Invoices → reload → still visible; a brand-new tenant still gets the three columns hidden on first load.

---

# BATCH 5 — SCHEDULER 🟧
Detail: `ground-zero-triage.md` → SCHEDULER section.
1. **LEAVE-MODEL-DUPLICATION (first — it unblocks the rest).** Two representations of "who is off": `TimeOffRequest` (ranges + approval) vs `ScheduledShift{status:'leave'}` (single-day, admin-created, `CreateShiftForm.tsx:482-496`). **Make `TimeOffRequest` canonical**; admin leave writes an auto-approved request; the scheduler **renders those as absence blocks** — which also delivers `SCHED-ABSENCE-IN-GRID`. Migrate existing `status:'leave'` shifts (additive, reversible, dry-run first).
2. **SCHED-SERIES-ID** — add `seriesId String?` (additive, indexed) to `ScheduledShift`; stamp on every shift in a batch. Then a **scope flyout** on edit/delete: *This occurrence · This and following · Entire series* — **radios**, default *This occurrence*. **Build ONE reusable scope-picker** shared with `TS-8` (cost-rate scope).
3. **SCHED-CONVERT-TO-RECURRING** — "Make recurring" on an existing shift; preview the count before creating.
4. **SCHED-DATE-RANGE** — ranges for leave **and** shifts. **Weekends skipped by default with an "include weekends" toggle** (Florin: Saturday work happens but isn't constant). Always show **day count + actual dates** before writing. Honour `WorkerSchedule`; public holidays are a later refinement.

---

# BATCH 6 — TIMESHEET REPORTING (after Batch 3)
Full spec: `coral-timesheet-reporting.md`. Start with **TS-2b (approvals overview)** — approvals are currently **write-only**, so nothing can be tracked or confirmed. Then TS-1 (query layer), TS-2 (report UI), TS-3 (`ClockEntry.projectId` — entries clocked without a shift have **no project**), TS-8 (stamped `costRate` + scope flyout), TS-4 (XLSX + PDF werkbon; **no payroll CSV** — parked), TS-5 (werkbon photos).
Decided, don't re-ask: break auto-deducted (`noBreak` exists, **one shared calc function**); **no overtime concept**; `costRate` per user, **stamped on the entry**; `billable` at **entry** level (project reports billable + internal + total); payroll export and checkin@work **parked** in `coral-nice-to-have.md`.

---

# ALSO OPEN (not sequenced here)
`ENGINE-DND-REBUILD` engine wiring + the **invoice** pair — see `coral-engine-dnd.md` (RULE 0 atomicity; invoice gotchas: prefixed droppable ids, the **`modal-` droppable/portal** risk, credit-notes share the engine). `PROJ-1..7` — `coral-project-module.md` (PROJ-2 canonical status is **`t-*`**, NOT `opt-*`). Calendar — `coral-calendar.md` (CAL-0 tenant hardening first, then the Google connect flow, which is the actual blocker).
