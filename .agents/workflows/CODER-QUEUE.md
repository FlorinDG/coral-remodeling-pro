# CORAL — CODER QUEUE
**Current as of 2026-10-04.** This file is always the live queue — superseded items are removed, not renamed.
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

## 0 · `WH-7` — rebuild the shift editor — ✅ M3 ACCEPTED · 🟩 GO M4 (stop after M4)
📄 `coder-directive-wh-7.md` + **`.agents/plans/WH-7.md` § PLANNER REVIEW (C1–C6, binding)**.
M4 = the switch in `ScheduleManagement.tsx`, delete the legacy files, the eslint allowlist cleanup + the ONE M3
correction (plan § PLANNER REVIEW — M3: label the picked day from the ymd, never a midnight instant in the browser's
zone). Report `.agents/reports/WH-7-M4.md`. Push, STOP for review.
*(Done 2026-10-04: WO-4a-M4 ✅ · R2-1-CENSUS ✅ — 4 holes it found were fixed the same day.)*

## ✅ `R1-7-B1` — DONE, reviewed 2026-10-05 (STOP 1 decided: lib/data/identity emailOwner; 4 files moved by the Planner)
📄 `coder-directive-r1-7-b1.md` — notifications → calendar → tenant, one commit per module; each migrated file leaves
the R1-5 allowlist and lowers `CEILING` by the files removed, from its current value. STOP on any cross-tenant read. Report `.agents/reports/R1-7-B1.md`.

## 2 · `DB-HEADER-1` — one database header across the ERP — ✅ PLAN APPROVED WITH CORRECTIONS · 🟩 GO M1 (stop after M1)
📄 `coder-directive-db-header-1.md` — inventory the 19 database screens' headers, propose ONE pure rule
(`lib/records/db-header.ts`) + one component. Write `.agents/plans/DB-HEADER-1.md`, push, STOP.

## 3 · `R2-1-B` — the remaining direct record writes onto the one door — ✅ PLAN APPROVED WITH CORRECTIONS · 🟩 GO M1 (stop after M1)
📄 `coder-directive-r2-1-b.md` — re-measure the census, every direct GlobalPage write → `saveRecord` / `deleteRecord`
on the caller's scoped door (session / system / portal), or justified in writing. Plan `.agents/plans/R2-1-B.md`, STOP.

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

## THEN, in order
`TD-4` tail *(5 grandfathered files)* · `KERN-8` · `R1-2`/`R1-3` → `R1-4`+`R1-5` · `ENT-1…24` · `WB-A…E` *(the werkbon — phasing awaits Florin)*.
Recorded, not queued: `WH-EXPORT-1` (worker timesheet export) · `I18N-TT-1` (the time-tracker locales have no test guard) · `erp-tasks` keeps its own 3-role list (Tasks entitlement) · `AUTH_SECRET` fallback in the unlock cookie · `locked['projects'] || 'db-1'` fail-open (R1-2) · partial unique index on open clock entries (Florin's migration, when wanted) · `/workhub/profile` still English/"Workforce Member".

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
