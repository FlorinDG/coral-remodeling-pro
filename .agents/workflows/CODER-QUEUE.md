# CORAL — CODER QUEUE
**Current as of 2026-09-30.** This file is always the live queue — superseded items are removed, not renamed.
🛑 **The filename never carries a date.** `PLANNER-HANDOVER.md` §7 points here permanently.

**Work top to bottom. Each item is a separate commit set. Report after each.**
🔴 **Every item ends with `.agents/reports/<ITEM-ID>.md`, written per `coder-report-protocol.md`, committed last.** No report file = the item is not done.
🟢 Florin has authorised direct promotion to `main` for now. 🟨 *(Planner: this conflicts with `pd.md` 5f "no promotion" — Florin to confirm which stands.)*

🔴 **WorkHub first.** Nothing below item 1 starts until Florin has verified `WHS-1` + `WHS-1b` on a phone, as a workforce user.

## 🟢 THE CODER'S LANE, NOW — `ERR-1` · one `describeError`, ~45 sites
📄 `coder-directive-err-1-describe-error.md`
**Runs in parallel with the Planner implementing `WHS-1b` directly.** 🔴 **Respect its HARD FENCE — those files belong to the other writer.** No checkout, no stash, stage by explicit path.

---

## 1 · `WHS-1b` — 🔴 the clock never acts on unknown state — **PLANNER IMPLEMENTS, not the coder**
📄 `coder-directive-whs-1b-unknown-state.md`

- **Blocked on Florin's §0 query** (users with >1 open clock entry).
- Server refuses a second open `ClockEntry` for the same user (`409`, returns the open entry); client adopts it.
- Delete `ClockButton`'s 3 s shifts timeout — **a slow network currently clocks in "without shift" and creates a duplicate shift.**
- A failed refetch keeps the week on screen; six missing i18n keys; `Math.max(0, …)` back in `useTimer`.
- 🛑 No schema change. `useTimer` stays per-component.

---

## 2 · `SCH-8` / `HR-TS-8` — the series scope; the manual-entry project select
📄 `coder-directive-sch-8-series-and-manual-entry.md`

"Save for all" on a recurring series does nothing; `ManualEntryModal` project select → `SearchableSelect` over `erp-projects`.

---

## 3 · `PROJ-SSOT-1` — one project resolver, `HrProject` retired
📄 `coder-directive-proj-ssot-1-retire-hrproject.md`

🔴 **Blocked on the export census** — `proj-ssot-1-export-census.sql`, run by Florin. **§1's premise is measured before any code moves.**
🟨 Planner correction to §1: the code prints **`Unknown Project`** (not blank) for an unresolved `projectId`, and **`Unattributed`** for none. The census says how many rows are each.
🛑 Phase 2 (schema) is separate and gated.

---

## THEN, in order
`TD-4` tail *(5 grandfathered files)* · `KERN-8` · `R1-2`/`R1-3` → `R1-4`+`R1-5` · `ENT-1…24` · `WH-2` *(rebuild WorkHub Home)* · `WB-A…E` *(the werkbon — phasing awaits Florin)*.
Recorded for scheduling, not queued: `WH-EXPORT-1` *(worker-facing timesheet export)*.

---

## ✅ LANDED SINCE THE LAST QUEUE — by commit; 🟨 = not yet verified by the Planner against its directive
| Item | Commit | Verified |
|---|---|---|
| `HR-TS-6` edit pane read in local time | `8bed336` | ✅ read path uses `format(parseISO(…))` |
| `HR-TS-1/2` approve/deny, `approvedBy`, werkbon fixes | `457f1a1` | 🟨 |
| `HR-TS-3` thumbnails, one URL resolver | `9248788` | 🟨 |
| `HR-TS-5` detail edit mode | `e87093f` | 🟨 |
| `HR-TS-7` provenance *(its migration = `INC-2`)* | `0d56eb9` | 🟨 |
| `TD-4` allowlist 36 → 5 | `dc26631` … `63a25b7` | ✅ |
| `WH-UI-1` §9 | `9c63229`, `f051147` | ✅ |
| `WHS-1` §1–§4 | `aff03a0` | ✅ code · ⏳ phone verification (§6) is Florin's |

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
🔴 **`WB-D` (the freeze) must not land after `WB-C` (signing).**
