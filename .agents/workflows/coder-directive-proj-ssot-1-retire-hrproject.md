# CORAL — CODER DIRECTIVE — `PROJ-SSOT-1` · one project source, `HrProject` erased — Planner 2026-09-29

```
BLAST RADIUS — phase 1 only these files may change:
  src/app/api/hr/lib/…            (new: the shared project resolver)
  src/app/api/hr/[entity]/route.ts
  src/app/api/hr/timesheet-export/route.tsx
  src/app/api/hr/timesheet-reports/route.ts
  src/lib/data/shift-brief.ts
  src/components/time-tracker/hooks/useScheduledShifts.ts
  src/components/time-tracker/hooks/useProjects.ts
  src/app/[locale]/admin/hr/timesheets/ManualEntryModal.tsx
Phase 2 (schema/scope-rules) is SEPARATE and gated — see §4.
Anything else: STOP AND REPORT. A better idea is a report, not a commit.
No branch move, no promotion, no migration run.
```

> **Florin:** *"SSOT is the way. We destroyed one, erase all trace of it."*

**`HrProject` is empty** (`count = 0`). 🔴 **But erasing it is NOT a deletion pass — four server-side name resolutions read it EXCLUSIVELY, and they are broken right now.**

---

# 1 · 🔴 WHAT IS ALREADY BROKEN — measure this before anything else

```ts
timesheet-export/route.tsx:105   prisma.hrProject.findMany(…)   → the 'Project' COLUMN
timesheet-reports/route.ts:121   prisma.hrProject.findMany(…)   → the by-project ROLLUP
[entity]/route.ts:356            prisma.hrProject.findMany(…)   → SCH-7 shift project names
lib/data/shift-brief.ts:107      prisma.hrProject.findFirst(…)  → the shift brief
```
**All four resolve names from a table with zero rows.**

> ## 🔴 So the accountant export's `Project` column is blank on every row, and the by-project report groups nothing.

- [ ] **CONFIRM IT FIRST.** **Export one month and open it. Report what the `Project` column contains.** 🛑 **If it is populated, STOP — the Planner's reading is wrong and the rest of this directive is built on it.**
- [ ] 🟢 **This reframes the whole item: it is not tidying, it is repairing four broken lookups.** **Deleting the reads without replacing them turns blank into crashed.**

---

# 2 · THE CAUSE — `projectId` is an unconstrained string

```prisma
ClockEntry.projectId      String?     // no FK
ScheduledShift.projectId  String?     // no FK
```
**Nothing in the schema references `HrProject`** — only `Tenant.hrProjects HrProject[]`. 🔴 **So `projectId` may point at an `HrProject`, a `GlobalPage`, or an `InternalProject`, and the database cannot tell which.** **Three sources, one column, no constraint — that is the split Florin is closing.**

---

# 3 · PHASE 1 — ONE RESOLVER, SERVER-SIDE

The merge already exists, **inline in one route** (`[entity]/route.ts`, the `erp-projects` branch): `GlobalPage` where `databaseId = locked['projects']` **plus** `InternalProject`, merged.

- [ ] 🔴 **LIFT IT INTO ONE EXPORTED HELPER** — `resolveProjects(tenantId)` → `Map<id, { id, name, address?, lat?, lng?, source }>` — in `src/app/api/hr/lib/`, beside `team-scoping`. 🛑 **Do not copy the merge into four files.** *(`pd.md` 4z: one concept, one definition, frozen. Four copies of a resolution rule is `INC-1`'s shape.)*
- [ ] **All four sites in §1 call it.** **`hrProject` appears in none of them afterwards.**
- [ ] 🟨 **`[entity]/route.ts`'s `erp-projects` branch calls the same helper** — it stops being the definition and becomes a consumer.
- [ ] 🔴 **Keep the non-admin gate.** The `erp-projects` branch filters non-admins to projects they have shifts on. **The helper must take the caller's scope, not silently widen it.** 🛑 **A helper that drops that filter is a tenant-data leak dressed as a refactor.**

## 3b · THE CLIENT SIDE
- [ ] **`useScheduledShifts:125` — drop `hrList('projects')`** and the `[ERP] ` prefix. 🟢 **One fewer endpoint that can fail on a phone — serves `WHS-1` §1 directly.**
- [ ] **`useProjects.ts:25` → `erp-projects`**, or delete the hook if nothing uses it. **Report which.**
- [ ] **`ManualEntryModal` → `erp-projects` + `SearchableSelect`** *(as specified in `HR-TS-8`; if that has landed, this is already done — **verify, do not redo**)*.
- [ ] 🔴 **`grep -rn "hrList<[^>]*>('projects')\|hrList('projects')" src/` → ZERO.**

---

# 4 · PHASE 2 — THE DROP. 🛑 GATED. DO NOT START UNTIL PHASE 1 IS LIVE AND VERIFIED.

## 🔴 A DESTRUCTIVE MIGRATION INVERTS THE DEPLOY ORDER
**Additive (`pd.md` 5e): database first, code second.**
**Destructive: CODE FIRST, database second.** 🔴 **The table may only be dropped once no deployed code references it — and "deployed" means live, not merged.**

- [ ] **Order, strictly:**
  1. Phase 1 lives in production and Florin has confirmed the export shows real project names.
  2. **Re-confirm emptiness, ACROSS ALL TENANTS, no filter:**
     ```sql
     SELECT count(*) FROM "HrProject";
     ```
     🛑 **Not zero → STOP and report. Florin decides.**
  3. Remove `model HrProject` and `Tenant.hrProjects`, remove `'projects': 'hrProject'` from `ENTITY_MAP`, remove `HrProject` from `scope-rules.ts:56`.
  4. **Write the migration. Hand it to Florin. WAIT.**
- [ ] 🟢 **The isolation test is the safety net.** `tests/tenant-isolation.test.ts` §2A asserts every model is classified. **Removing the model without removing its `scope-rules` entry — or the reverse — fails the build.** **Do both in one commit and let the test prove it.**
- [ ] 🔴 **NEON SNAPSHOT BEFORE THE DROP.** **Even of an empty table.** 🛑 **This is the first destructive migration in this codebase. It sets the precedent.**
- [ ] 🟨 **`ENTITY_MAP`'s `'projects'` key is a PUBLIC ROUTE.** **Removing it makes `/api/hr/projects` answer 400.** **Confirm nothing external calls it, and report.**

---

# 5 · 🔴 WHAT SSOT DOES *NOT* FIX — say it plainly
**Retiring `HrProject` leaves TWO sources: `GlobalPage` and `InternalProject`.** 🔴 **`projectId` remains an unconstrained string with no FK, so a project id still cannot be validated by the database.**
- [ ] 🛑 **Do not attempt to unify those two here.** **That is `PROJ-0` and it is Florin's design decision** *(`coral-decision-one-project.md`, `coral-walkdown-project-identity.md` — 73 project pages vs 1 `InternalProject`)*.
- [ ] 🟢 **This pass reduces three sources to two and gives them ONE resolver.** **Record honestly that the split is narrowed, not closed.**

---

# VERIFY
1. 🔴 **Export a month BEFORE the change. Record what `Project` contains. Export after. Report both.**
2. **The by-project report groups by real project names.**
3. **A shift's project name shows in the schedule** — unchanged or better, never worse.
4. **The shift brief resolves a project.**
5. 🔴 **As a NON-ADMIN: the project list is still limited to projects you have shifts on.** **Name the account you tested with.**
6. **Add manually → projects populated, searchable, matching the filter bar.**
7. **WorkHub loads shifts with project names after the merge is dropped** — on a phone.
8. `grep -rn "hrProject\|HrProject" src/` → **phase 1: only `scope-rules.ts`. Phase 2: zero.**
9. `test:compile` · `test:lint` · suite — exit 0. **Isolation test green.**

## PROHIBITIONS
- 🛑 **Do not run the migration. Do not drop the table.**
- 🛑 **Do not start phase 2 before phase 1 is live and confirmed.**
- 🛑 **Do not copy the project merge into more than one file.**
- 🛑 **Do not widen the non-admin project filter.**
- 🛑 **Do not touch `GlobalPage` or `InternalProject` — that is `PROJ-0`.**
- 🛑 **If the export already shows project names, STOP — the premise is wrong.**
