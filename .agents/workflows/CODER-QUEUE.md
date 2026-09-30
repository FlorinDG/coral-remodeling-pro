# CORAL — CODER QUEUE
**Current as of 2026-09-30 (night).** This file is always the live queue — superseded items are removed, not renamed.
🛑 **The filename never carries a date.** `PLANNER-HANDOVER.md` §7 points here permanently.

**Work top to bottom. Each item is a separate commit set. Report after each.**
🔴 **Every item ends with `.agents/reports/<ITEM-ID>.md`, written per `coder-report-protocol.md`, committed last.** No report file = the item is not done.

## HOW WORK IS SPLIT NOW (Florin, 2026-09-30)
- **The Planner implements judgement-heavy and load-bearing items directly** (WorkHub, Gate 2, anything on hours or files).
- **The coder takes long, mechanical, well-specified items** under a HARD FENCE of files it may not touch.
- **Promotion:** during the WorkHub iteration phase the Planner promotes green commits to `main` (CI + Vercel preview green on the exact commit, no `prisma/`/package change in the range, rollback hash noted). **Ends when Florin says we are back to develop-only.**

---

## 1 · `SCH-8` / `HR-TS-8` — the series scope; the manual-entry project select
📄 `coder-directive-sch-8-series-and-manual-entry.md`
"Save for all" on a recurring series does nothing; `ManualEntryModal` project select → `SearchableSelect` over `erp-projects`.

## 2 · `PROJ-SSOT-1` — one project resolver, `HrProject` retired
📄 `coder-directive-proj-ssot-1-retire-hrproject.md`
🟢 **Census done (2026-09-30):** 27 clock entries (Coral only) — 26 unattributed *by design* (Florin tests clock-in without shift; `pd.md` 4x), 1 dangling (27 Jul) → **cleared by Florin, hours kept.** **No row is broken today; it goes off the first time hours are attributed with the HR-TS-5 picker and exported.** Land before that.
🟨 §1 correction: unresolved `projectId` prints `Unknown Project`, not blank.

## 3 · `FILES-GATE-1` → folds into `ENT` — 🟢 **Florin decided the model (2026-09-30)**
> *"roles are to be confined by their function. hr will not work with financials and vice versa … director, owner have full oversight, project manager to his own. all roles can be granted access to other modules/submodules … in the tenant app settings, gated, accessible to the owner role."*
- **Inside one tenant (the seraph has already scoped it), a role reaches only its FUNCTION by default:** HR → HR; bookkeeping → financials; project manager → **their own** projects; director + owner → everything.
- **The owner grants extra modules / submodules to a role** in tenant settings (owner-only, gated).
- **Files follow the module they belong to** — an invoice PDF is financials, a clock photo is HR. `crew-file-policy.ts` is the first instance; this generalises it.
- 🟨 Open: grants **per role** (Florin's words) vs the existing **per person** `User.moduleAccess` (Settings → Team) — see chat 2026-09-30.

## 4 · `TASK-CREW-1` — 🟢 **Florin decided (2026-09-30):** the crew updates task status and writes notes with photos; the app keeps a detailed log of changes, **read-only for every role**
- Crew may change the status of a task **assigned to them**. Management still sees and can override.
- Crew notes: details + photos, in reference to the task.
- **Every change** (status, note) → an immutable log entry (who, when, before → after), shown read-only on the task in the ERP and the WorkHub. *(AuditLog is already immutable — `POST /api/hr/audit-logs` is refused.)*
- 🟨 Open: notes append-only vs editable · storage (new table + Florin's migration vs task JSON property) — see chat.

## 5 · `GATE-2b` — crew self-service on shifts, tasks, attachments
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
