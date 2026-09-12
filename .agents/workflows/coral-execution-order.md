# CORAL — EXECUTION ORDER — the single binding sequence — Planner 2026-09-12

**Florin, 2026-09-12: *"sequential, from the core to the leaf, and restrict the coder from proceeding any other way."***

**This file overrides the internal ordering of every other spec.** Where a spec's own "ORDER" section disagrees with this one, **this one wins**. Specs say *what* and *how*; this says *when*, and *only this*.

---

## 🔒 THE RULE — read before every session

1. **Work the FIRST unblocked item in the sequence below. One item. Nothing else.**
2. **Do not start the next item until the current one is committed, verified, and reported.**
3. **No unrequested work.** Not a refactor you noticed, not a file you were "already in", not an improvement. If you see something, **write it in the report** — do not fix it.
4. **If an item is blocked, STOP and report.** Do **not** skip ahead to a later item, and do not substitute a different one. A blocked queue is information; a reordered queue is a lost audit trail.
5. **Items marked `FLORIN` are decisions you never make.** Not by inference, not by picking the "obvious" option, not by implementing one and noting the other. Stop and ask.
6. **Stay inside the files the directive names.** A change to a file not named is a stop-and-ask, even if it is one line, even if it is obviously right.
7. **Every item ends with the same two commands** — no substitutes, no single-file runs:
   ```bash
   npm run test:compile
   node --experimental-strip-types --import ./tests/register.mjs --test 'tests/*.test.ts'
   ```
   `jest` and `tsx` are **not installed**. `tests/i18n.test.ts` is pre-existing red; never edit or skip it.

**Why this exists:** the last batch breached a scope fence, took a decision reserved for Florin, and proposed a test runner that is not installed — in a single plan. None of that was a coding failure; all of it was ordering and scope. The rule is the fix.

---

## PHASE 0 — BLOCKED ON FLORIN *(nothing below proceeds past these where noted)*

| | Item | Notes |
|---|---|---|
| **0.1** | ~~`TASK-A-E1` — keep or revert `a2dc5ba`~~ | ✅ **RESOLVED (Florin, 2026-09-12): remove the dependency feature entirely.** *"I'd rather have subtasks than dependencies."* Now item **`1.0`** below — `coder-directive-dep-removal.md`. |
| **0.2** | **`TASK-A-E3` — the `t-*` vs `opt-*` live count** | **The coder runs this** (read-only) as the first action of `2.1`. **Clean → proceed without asking. Any `t-*` → STOP and report**; it is `PROJ-2` (parked). Only a dirty result needs Florin. |
| **0.3** | ~~`R2-6` — the read model~~ | ✅ **DECIDED (Florin, 2026-09-12): (c) STATED HYBRID** — INDEX always offline · WORKING SET persisted offline-complete · everything else per-view query. Recorded in `coral-r2-write-path.md`. **`4.5` is unblocked and re-cut.** |

---

## ▶️ AUTHORISED RUN — `1.2` THROUGH `2.4`, NO CHECK-IN REQUIRED (Florin, 2026-09-12)
The coder proceeds through items **1.0 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3 → 2.4** in order, **without pausing for approval between them.** Report after each item as specified; do not wait for a reply. The rules in §🔒 still bind — in particular, **stop and report** on: a blocked item · a `FLORIN` decision · a file not named in the directive · a dirty `t-*` count at `2.1` · a surface fitting neither class A nor B at `1.2`.
**Do not proceed past `2.4` into Phase 3.** Parts B/C and `DEP-*` remain unauthorised.

## PHASE 1 — READ-MODEL CORE 🟥 *live regression; users are being shown empty screens now*
Spec: `coral-lazy-load-regression.md`

| | Item | Gate |
|---|---|---|
| **1.0** | **`DEP-REMOVE` — delete the dependency graph, engine, tests and render path.** Stored `prop-task-depends-on` **data is left untouched**. | `coder-directive-dep-removal.md`. Fence exception, limited to the named files. |
| **1.1** | **`LAZY-1` — the sweep.** Table: surface · databases read · requests them Y/N · **currently broken Y/N**. | **REPORT ONLY. No code.** Florin sees the list before anything is fixed. |
| **1.2** | **`LAZY-2` — `usePagesOf(databaseId)` → `{pages, status}`.** Not-loaded must be impossible to mistake for empty; dev warning names database + caller. | This is also the seam that makes `R2-6` affordable later. Build it whichever way `0.3` goes. |
| **1.3** | **`LAZY-3` — `TaskModuleShell`:** `resolveDbId` at all 5 sites + request pages. | **Fence exception granted — that file and nothing else in `components/admin/tasks/`.** |
| **1.4** | **`LAZY-4` — the flag.** Default off until `1.1` is clean, **or** delete the flag and declare lazy permanent. | Not the current middle state. |

---

## PHASE 2 — TASKS, LEAF 🟧 *Florin's daily tool; only after Phase 1*
Spec: `coral-task-manager.md` · Directive: `coder-directive-tasks-part-a.md`

| | Item | Gate |
|---|---|---|
| **2.1** | **`TASK-M1` correction** — ownership scoping (`isMyTask`), and `opt-*` status read **and** written. **No `t-*` hedge.** | Blocked on `0.2`. |
| **2.2** | **`TASK-M11` — task detail sheet.** Tap row → editable detail. Planner omission; Part A is not usable without it. | |
| **2.3** | **`TASK-M10` — assign to project.** Picker from in-memory `pageIndex` filtered to `db-1`. **No `getDatabasePages('db-1')`.** | |
| **2.4** | **`TASK-M2`/`M3` status + `TASK-A-E7` timings.** Report the measured figures: 1 tap from the Tasks icon, ≤2 taps / ≤5 s cold. | Report, not prose. |

**Then STOP.** Part B (project lens) and Part C (desktop) are **not** authorised. `TASK-SUBTASKS` is **not** authorised. Dependencies are **withdrawn**, not pending.

---

## 🛑 PHASE 2 IS NOT CLOSED — `2.5` ADDED (Planner, 2026-09-12)

**A stop condition was logged instead of obeyed.** Gate `0.2` read: *"Any `t-*` → **STOP and report**."* The coder's `2.4` report states, under *Deliberately Not Fixed*: *"The **38 live `t-*` task records** in Postgres were counted (read-only) and remain untouched."*

**38 is not zero.** The count was run correctly, the finding was reported honestly — and then the run continued through `2.1`, which **removed the legacy read**. `m/tasks/page.tsx:66` is now `isDone = status === 'opt-done'`, so a record stored as **`t-done` is not recognised as done**, passes the open-task filter, and **appears in Florin's list as outstanding work.**

The tool built to be trusted is currently showing some completed tasks as open.

⚠️ **Rule clarification, binding from now on: a STOP condition is not satisfied by logging it.** "Deliberately not fixed" covers things you *noticed*; it does not cover a gate the directive told you to halt on. If a gate trips, the item is **blocked** — stop there, do not carry on and file it.

*(Planner's share: the "no `t-*` hedge" instruction in `2.1` was correct **only** if the count came back zero. It was written as unconditional. That is why the gate existed — and why running it before the edit was the whole point.)*

| | Item | Gate |
|---|---|---|
⛔ **Retracted first attempt, for the record:** `2.5` was briefly "migrate the 38 records to `opt-*`". The count came back `t-todo 22 · t-prog 11 · t-done 5`, **all 38 carrying a project** — they are **not legacy**. `t-*` is the live convention of the **project subsystem** (written by `ProjectDetailView:422/439`, `ClientQuotationEngine:734`, `quote-service:128`; read by the progress automation at `store.ts:1699-1715`, which marks a project Done only when every task is `t-done`). **That migration would have broken project completion and is cancelled.** `task-status-38-records.sql` Steps 3-4 must not be run.

**→ `2.5` IS `TS-1`. That is the single item to hand the coder.**

| | Item | Gate |
|---|---|---|
| **2.5 = `TS-1`** | **Mobile reads BOTH conventions, writes only `opt-*`.** `isDone` accepts `opt-done` **or** `t-done`; the open-list filter excludes `opt-done`/`opt-dropped`/`t-done`. Comment the reason at the read site naming `PROJ-2`. Extend `tests/task-part-a.test.ts` (`t-done` -> done; `t-todo`/`t-prog` -> open). **Only `src/app/[locale]/m/tasks/page.tsx` and the test file.** | Spec: `coral-task-status-two-subsystems.md`. **Reverses the earlier "no `t-*` hedge" instruction.** **No project-subsystem files. No data migration.** |

**Phase 2 closes when `2.5`/`TS-1` is verified — the 5 `t-done` project tasks no longer show as open on mobile, `t-todo`/`t-prog` still do, and the project progress automation is untouched.** Only then does `3.1` begin.

*(Planner error, recorded: `t-*` was read as legacy from a value mismatch, without tracing **who writes it**. The `grep` that revealed five live writers should have preceded the SQL. Same failure mode flagged twice in the coder's plans — inference from code shape instead of evidence.)*

---

## PHASE 3 — R1 · TENANCY ROOT 🟥
Spec: `coral-r1-tenancy.md`

**3.1** `R1-1a` reconcile the two system-database lists (+ read-only mis-scoping count) · **3.2** `R1-1b` `logicalKey` on `GlobalDatabase`, backfilled from `getBaseDbId` · **3.3** `R1-2` canonical fail-closed resolver; delete the `(base) => base` default · **3.4** `R1-3` server never trusts a supplied id · **3.5** `R1-4` + `R1-5` accessor **and** CI gate — **ship together or not at all** · **3.6** `R1-6` system writers + `vat-backfill` · **3.7** `R1-7` migrate the call sites, module by module.

⚠️ `3.2` needs a migration: **Florin runs it.** Additive, nullable, backfill, verify, then tighten — never `db push`, never `--accept-data-loss`.

---

## PHASE 4 — R2 · WRITE PATH ROOT 🟥
Spec: `coral-r2-write-path.md` · **Do not start before `3.5` is merged.**

**4.1** `R2-5` characterization tests **first** · **4.2** `R2-1` one `saveRecord()` (also fixes the fabricated `blocks: []` / `blocksVersion: 1` return, `R2-1-FABRICATED-PAGE`) · **4.3** `R2-2` field-level intents · **4.4** `R2-3` one authority on "current"; re-prove the single-flight lock · **4.5** `R2-4` — **re-cut by the `(c)` decision: shrink the store to INDEX + WORKING SET + sync queue**, not a four-way split. The general page cache goes; dirty-page protection and the queue are untouchable. · **4.6** `R2-7` **what defines a working set** (explicit pin? today's shifts? last-opened?) — **FLORIN decision, do not infer.**

---

## PHASE 5 — LEAVES *(unlock only when Phases 1–4 are done; order within is Florin's call)*
`GRID-REPLACE 1…5` (which retires the `OVL` shield) · `R4` document engine, characterization first · `DOC-ARCH-2/3/6` (needs `R4-1`) · `R3-A2/A3/A4` grid-independent leaves · `TASK` Parts B and C · `TASK-SUBTASKS` (replaces dependencies) · `I18N-MISSING-KEYS` · `MAIL-4` · `BLOB-6` · `TASK-M3b` cold offline · `MEM-3d/3e`.

---

## REPORTING — required at the end of every item
1. **Item id and commit hash.**
2. **What was measured**, where the item asks for a number — not "verified", the figure.
3. **Anything noticed and deliberately not fixed** (rule 3).
4. **The next item in this file**, named — confirming the sequence, not choosing one.
