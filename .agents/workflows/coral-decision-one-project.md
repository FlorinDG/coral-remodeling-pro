# CORAL — DECISION — ONE PROJECT, ONE DATABASE — Florin 2026-09-24

> **Florin:** *"there is only one projects database, and the scheduler must not create a link somewhere in open outer space, but connect to real db. and there is only one to connect to."*

**`PROJ-0` is decided.** The canonical project is **the page in the tenant's projects database**. Everything on the workforce side — shifts, clock entries, timesheets, attachments, notes, reporting — relates to *that*, and to nothing else.

**The rule stated as a test:** *a project reference that does not resolve to a row in the projects database is not a project reference.* No second list, no shadow record, no prefix.

---

# 1 · WHAT FOLLOWS AUTOMATICALLY

| | |
|---|---|
| **`HrProject` is retired** | The scheduler stops creating projects. Its "new project" path (`useProjects.ts:40`, `useScheduledShifts.ts:261`) is **removed**, not hidden. *(D5 precedent: dead means gone.)* |
| **The `[ERP] ` prefix dies** | It exists only to distinguish two lists. One list, no prefix. `useScheduledShifts.ts:119` and `route.ts:353` both go. |
| **The merged dropdown dies** | `allProjects = [...hrProjects, ...erpProjects]` becomes one query against the projects database. |
| **`InternalProject` needs no id change** | Quote-accepted projects **already** carry the page's id (`quote-service.ts:52 & 86`). Pointing at the page id resolves for them too. **The id pun, which was the defect, is also the thing that makes this cheap.** |

🟢 **Only `HrProject`-native links are genuinely orphaned by this decision.** Everything else already points at the right id by accident. **Query 3 of the `PROJ-0` census sizes exactly that set** — and it is now the only number that matters.

---

# 2 · 🔴 THREE THINGS THE DECISION DOES NOT DECIDE

## `D-A` · "Points at a project" is NOT expressible as a foreign key
`GlobalPage` is **polymorphic** — one table holds every row of every user database. `ScheduledShift.project → GlobalPage` enforces *"points at a page"*. **It does not enforce "points at a project page"**; that lives in `databaseId`, which is user-configurable data.

**So the constraint has to be enforced where the write happens**, and that means it belongs to the gate, not to Postgres:
- [ ] On any write that sets a project reference, **resolve the id and verify its `databaseId` is the tenant's projects database.** Reject otherwise.
- [ ] 🟢 **This is `TenantScopedClient` work, not scheduler work** — the same shape as `TSC-0 D7`'s Class-B parent check. **Write it once, in `scope-rules`/`R1-4`, not per call site.** *(Otherwise it is `TSC-4` all over again: four doors, three check.)*

## `D-B` · 🛑 DELETING A PROJECT MUST NEVER DELETE HOURS
`GlobalPage` cascades from `GlobalDatabase`. If project references cascade too, **deleting a project page deletes the shifts and clock entries attached to it — payroll data.**

- [ ] **`onDelete: Restrict` (or `SetNull`), never `Cascade`**, on every workforce-side project reference. 🔴 **This is the opposite of `TSC-4`'s answer and the difference is the data:** a shift task is meaningless without its shift; **a worker's hours are meaningful without the project.**
- [ ] **Same principle as `HRA`:** *the entry is real work and is always recorded.* An unresolvable project drops the linkage, never the hours.
- [ ] **Decide which:** `Restrict` (a project with hours cannot be deleted — forces an explicit reckoning) or `SetNull` (hours survive, unlinked). **Planner leans `Restrict`** — silent unlinking is how labour cost goes missing from a P&L without anyone noticing.

## `D-C` · The `HrProject` reconciliation is MANUAL and cannot be automated
There is no mapping between an `HrProject` row and a project page. **Nobody can derive it** — name similarity is a guess, and a wrong guess puts labour cost on the wrong job.
- [ ] **Florin maps them by hand**, from a list, once. Query 3 says how long that list is.
- [ ] 🛑 **The coder does not fuzzy-match names.** A wrong mapping is worse than a null one: a null is visible, a wrong one looks like an answer.
- [ ] Shifts whose `HrProject` has no real counterpart → **project reference set null, hours retained**, and surfaced in a report so they can be assigned later.

---

# 3 · 🔴 `PROJ-0c` IS NOW LOAD-BEARING — it was cosmetic yesterday
```ts
const projectDbId = locked['projects'] || 'db-1';     // route.ts:146
```
**If "the one projects database" cannot be resolved, this silently picks `db-1`.** Under the old design that produced a bad list. **Under this decision it writes project links into the wrong database** — and for a second tenant, `db-1` is not theirs at all.

- [ ] 🛑 **Fail closed.** No projects database configured → **the operation is refused**, not defaulted. *(`R1-2`: absence is a question, not an answer.)*
- [ ] **Raise `PROJ-0c` from P2 to P0.** It is now a correctness precondition for every workforce-side write.

---

# 4 · SEQUENCE
```
R2 core write path  →  GRID-REPLACE  →  PROJ-0c (fail-closed resolution)
   →  D-C reconciliation (Florin, by hand)  →  relations + D-A/D-B  →  PROJ-1…7
```
**`D-C` gates the rest** — the relations cannot be declared while links point at rows that are about to stop existing.

## WHAT IS STILL NEEDED BEFORE ESTIMATING
- [ ] **Census query 3** — how many shifts point at `HrProject`. **The whole cost of this decision is that one number.**
- [ ] **Florin's answer on `D-B`** — `Restrict` or `SetNull`.
