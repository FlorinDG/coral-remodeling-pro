# CORAL — PROJECT MODULE (the command center) — Planner design + build plan 2026-07-22

**Florin:** "proper attention to the projects module — right where I should do a lot of work, I am not doing any."
**Why:** the module is NOT empty — it's crashing, buggy, and half-finished, so it's avoided. `ProjectDetailView` is 1,563 lines (tabs: overview/tasks/journal/files/vorderingen; aggregates tasks, quotes, shifts, labour hours, expenses, invoices, payments, vorderingen; renders PageFinancialAnalysis, ProjectCockpit, JournalCard, LinkedRecords, SupplierQuotationsCard, Attachments). The bones are there. Make it the daily hub.

## THE VISION — a project is the hub; everything converges on one screen
A construction contractor lives in the project. One detail screen should answer, at a glance: *is it on time, is it on budget, what's left to do, who's on it, what's been billed/paid, and am I making money.*
1. **Header / status / location** — name, client, **location (clickable → opens nav app, `PROJECT-LOCATION-FIELD`)**, type, lifecycle status (lead → won → in-execution → completed → invoiced → closed), timeline (start/end, % elapsed).
2. **Financial cockpit — the live P&L (the heart):**
   - **Revenue:** quoted (sum of ALL linked quotes + addendums) → ordered (client PO-in) → invoiced (connected invoice records) → paid (payments-in).
   - **Cost:** budget → **committed (open PO-out — ordered, not yet billed)** → actual (purchase invoices + labour cost) → paid (payments-out).
   - **Margin:** quoted margin vs **realized margin** (revenue − actual+committed cost), live. This is the number Florin should see first.
   - Progress % (tasks), budget-spent %.
3. **Documents panel** — every linked doc (proposal / quote / addendum / PO-in / PO-out / purchase-invoice / sales-invoice / payments / vorderingen) with status + amount, each opening its record.
4. **Tasks** — project tasks with consistent status + progress.
5. **Crew & schedule** — shifts scheduled on this project + who's assigned; **clocked hours (actual labour) vs quoted labour**.
6. **Journal** — site visits / progress notes.
7. **Files** — project attachments.

## CURRENT STATE (what exists vs what's broken)
- ✅ Tabbed detail, financial aggregation scaffolding, a cockpit, journal, linked records, attachments — all present.
- 🔴 **Crashes on open** (`ADMIN-QUERYCLIENT-PROVIDER`) — provider now mounted, VERIFY; finish tenant guarding.
- 🟧 **Financial totals wrong** (`PROJECT-TOTALS-AGGREGATE`): quotes count first-only (`.find`), invoiced reads `vorderingenstaten` not connected invoice records.
- 🟧 **Task-status IDs disagree** between components → wrong progress counts (see build item below).
- 🟧 **Cockpit incomplete** — Florin: "the cockpit doesn't really look like this"; shows only task progress + budget-spent, missing margin/committed-cost/doc-status/crew.
- 🟦 **No documents panel / full rollup** (`PROJ-DOC-ROLLUP`), no committed-cost layer, no crew-hours-vs-quoted.

---

# 🔴 PROJ-0 · WHAT IS A PROJECT — added by Planner 2026-09-24, ahead of everything below

**Florin, 2026-09-24:** *"much, if not most, depends on projects module being airtight."* **Correct — and the reason it is not airtight is not in the UI.**

## "Project" currently denotes FOUR things
| Source | What it is | Who reads it |
|---|---|---|
| **`GlobalPage`** in `lockedDbIds['projects'] ?? 'db-1'` | the dynamic projects database | the list grid (`DatabaseClone`) |
| **`InternalProject`** | Prisma model, ERP side | `/api/hr/erp-projects` |
| **`HrProject`** | Prisma model | `ScheduledShift.projectId` name enrichment (`route.ts:345`) |
| **`CMS_Project`** | public website portfolio | marketing site |

Plus `ProjectUpdate` · `ProjectMedia` · `Document` · `Message`, which hang off `ClientPortal`, not off any of the above.

## 🔴 The join is carried by a STRING PREFIX
`/api/hr/erp-projects` (`route.ts:137-175`) is a **virtual entity that merges `GlobalPage` + `InternalProject` at read time**. `useScheduledShifts.ts:119` then stamps the name:
```ts
name: `[ERP] ${p.name}`        // written here …
projectName.replace('[ERP] ', '')   // … stripped at route.ts:353
```
**Two representations of one concept, reconciled by a substring.** *(Defect shape #1, in its purest observed form.)*

## 🔴 TEN `projectId` COLUMNS, ONE DECLARED RELATION
```
ProjectUpdate · Document · ProjectMedia · Message · Invoice
TimeEntry · ClockEntry · ScheduledShift · ShiftTemplate · UserProjectAccess
```
**None declares `@relation`.** The only project relation in the schema is `CMS_ProjectImage → CMS_Project` — *the marketing site.*

**This is the `TSC-4` Class-C shape at ten sites, on the module everything else depends on.** It means:
- **The cockpit cannot prove its own arithmetic.** Revenue and cost are summed across quotes, invoices, shifts and clock entries — **every one of those joins on a `projectId` with no declared target.** A rollup over an unprovable join is a number that looks authoritative and is not.
- **The tenant gate cannot reach through.** `where: { project: { tenantId } }` is inexpressible, exactly as it was for `ShiftTask`. Every project-scoped query must improvise, and `TSC-4` is the demonstration of where improvisation leads.

## 🟨 `locked['projects'] || 'db-1'` is a fail-open magic default
`route.ts:146`. A tenant with no configured projects database silently gets `db-1`. **`R1-2` shape: absence answered instead of questioned.**

---

# 🔴 ONE LEVEL DOWN (Planner 2026-09-24) — THE JOIN IS AN ID PUN

## ✅ PLANNER CORRECTION FIRST
The paragraph above originally read *"a `GlobalPage` cannot be the target of a Prisma relation."* **That is false.** `GlobalPage` is an ordinary model with a cuid `@id`. **It can be a relation target.** The real objections to that shape are different and are stated below. *(Asserted from intuition about the dynamic system rather than from the schema. Corrected on reading it.)*

## WHAT ACCEPTING A QUOTE ACTUALLY DOES — `quote-service.ts:41-96`
```ts
const projectId = uuidv4();

await prisma.globalPage.create({      // ① the dynamic project page
  data: { id: projectId, databaseId: projectDbId,
          properties: { title: `[EXEC] ${title}`, … } } });

// 3. Create InternalProject (ERP/Scheduler shadow record)
await prisma.internalProject.create({ // ② the Prisma project
  data: { id: projectId,              // 🔴 THE SAME ID
          projectCode: `PRJ-${n}`, … } });
//        ^ comment in source: "Use same ID for consistency if possible, or link them"
```

**Two rows, two tables, one primary key.** The join between the dynamic project and the ERP project is **id equality** — never declared, never enforced, nowhere written down, and the comment beside it is a developer who had not decided *("…or link them")*.

**So there are three join mechanisms in play for one concept:**
| Mechanism | Where |
|---|---|
| **id punning** | `quote-service.ts:52 & 86` — GlobalPage.id === InternalProject.id |
| **`[EXEC] ` title prefix** | written `quote-service.ts:57` |
| **`[ERP] ` name prefix** | written `useScheduledShifts.ts:119`, stripped `route.ts:353` |

## 🔴 `HrProject` HAS NO WRITER IN THE ERP AT ALL
`grep` for `hrProject.create|update|upsert` in `src` → **nothing.** Every write reaches it through the generic `'projects' → 'hrProject'` mapping (`route.ts:33`), and the only callers are the **time-tracker's own hooks** (`useProjects.ts:40`, `useScheduledShifts.ts:261`). **`HrProject` is the parallel time-tracker app's private project list** *(`board-v2.md:748` — the half-migrated embedded app)*, not the ERP's.

### And that produces a resolution split
`ScheduledShift.projectId` can hold **either** an `HrProject.id` **or** a punned `GlobalPage`/`InternalProject` id, because the shift form offers `[...hrProjects, ...erpProjects]` merged.
- **Client** resolves from the merged map → name shows ✅
- **Server** (`route.ts:345`) queries **`hrProject` only** → ERP-born shifts get `projectName: undefined` ❌

**Two resolvers, one question, different answers.** Anything server-rendered or exported (`timesheet-export/route.tsx:103`, `timesheet-reports/route.ts:125` — both `hrProject`-only) is **missing the project name for every ERP project.**

## 🔴 THREE CREATION PATHS, THREE CONSISTENCY STATES
| Path | Creates | Twin? |
|---|---|---|
| **Quote accepted** (`quote-service.ts`) | GlobalPage **+** InternalProject, **same id** | ✅ both |
| **Manual ERP project** (`internal-projects.ts:28`) | InternalProject only | ❌ **no page** |
| **Row added in the projects grid** | GlobalPage only | ❌ **no InternalProject** |
| **Scheduler "new project"** (`useProjects.ts:40`) | HrProject only | ❌ unrelated to both |

**This is the cost driver, and it is countable.** See the census below.

---

## THE OPTIONS, RESTATED WITH WHAT WE NOW KNOW

### A · the project IS the `GlobalPage`
`InternalProject`/`HrProject` die or become views.
- 🟢 No hardcoded UI; custom properties for free; it is already the surface you work in.
- 🔴 **`GlobalPage` is polymorphic** — one table holds every row of every user database. A FK to it enforces *"points at a page"*, **not *"points at a project"***. The type lives in `databaseId`, which is **user-configurable data**. The constraint you want is not expressible as a foreign key.
- 🔴 **Cascade hazard:** `GlobalPage.database → GlobalDatabase onDelete: Cascade`. Deleting the projects database would cascade into **invoices**. Every project FK would need `onDelete: Restrict`, which is the opposite of `TSC-4`'s answer.

### B′ · `InternalProject` becomes canonical *(new — and cheaper than it looks)*
The dynamic page becomes the project's **property bag and document surface**; `InternalProject` is the identity.
- 🟢 **The id pun has already done most of the migration.** Every quote-born project **already** has an `InternalProject` with the page's id.
- 🟢 Already has `tenantId` (Class A, depth-0), already has `projectCode` as a human key, already unique per tenant.
- 🟢 Ten FKs become declarable; `where: { project: { tenantId } }` becomes expressible; the cockpit's arithmetic becomes provable.
- 🔴 Backfill needed only for the **non-twinned** rows — grid-created pages and scheduler-created `HrProject`s. **Count them before estimating.**

### C · keep two, add a real relation
- 🔴 **Blesses the shadow-record pattern.** Two representations survive, and every future feature must ask which one it means. *This is the defect, formalised.*

---

# 🛑 THE CENSUS THAT DECIDES IT — Florin, production branch, read-only
```sql
-- 1 · the three project populations
SELECT 'GlobalPage in projects db' AS what, COUNT(*) FROM "GlobalPage" p
  JOIN "GlobalDatabase" d ON d.id = p."databaseId"
  WHERE p."databaseId" = COALESCE(
        (SELECT "lockedDbIds"->>'projects' FROM "Tenant" LIMIT 1), 'db-1')
UNION ALL
SELECT 'InternalProject', COUNT(*) FROM "InternalProject"
UNION ALL
SELECT 'HrProject',       COUNT(*) FROM "HrProject";

-- 2 · how well does the id pun actually hold?
SELECT 'page WITH internal twin'    AS what, COUNT(*) FROM "GlobalPage" p
  JOIN "InternalProject" i ON i.id = p.id
UNION ALL
SELECT 'InternalProject, NO page',  COUNT(*) FROM "InternalProject" i
  LEFT JOIN "GlobalPage" p ON p.id = i.id WHERE p.id IS NULL;

-- 3 · what do the shifts actually point at?
SELECT CASE
         WHEN h.id IS NOT NULL THEN 'HrProject'
         WHEN i.id IS NOT NULL THEN 'InternalProject'
         WHEN g.id IS NOT NULL THEN 'GlobalPage'
         ELSE 'DANGLING' END AS target,
       COUNT(*)
FROM "ScheduledShift" s
LEFT JOIN "HrProject"       h ON h.id = s."projectId"
LEFT JOIN "InternalProject" i ON i.id = s."projectId"
LEFT JOIN "GlobalPage"      g ON g.id = s."projectId"
WHERE s."projectId" IS NOT NULL
GROUP BY 1;
```

**Query 3 is the one that decides.** If `DANGLING` > 0, shifts point at projects that no longer exist. If the split is heavily `HrProject`, the scheduler is the de-facto project list and `B′` costs more than it looks. **Do not estimate `PROJ-0` before these numbers exist.**

**The Planner's reading:** the `[ERP] ` prefix, the `[EXEC] ` prefix and the id pun are not three shortcuts that grew independently — **they are one missing relation, worked around three times.** Whichever shape wins, the test is: *afterwards, is there exactly one answer to "which project is this?", and can Prisma express it?*

## SEQUENCE — unchanged by this, and confirmed by it
```
kernel  →  R2 core write path  →  GRID-REPLACE  →  PROJ-0 (identity)  →  PROJ-1…7
```
`PROJ-7`'s health columns ride `DatabaseClone`, so they cannot precede `GRID-REPLACE` *(`coral-r3-grid.md` — a leaf with dependents is done before its dependents)*. **`PROJ-0` sits between them: after the surface is settled, before anything aggregates across it.**

---

## BUILD PLAN (ordered)
- [ ] **PROJ-1 · ACCESS** 🟥 — verify the crash is gone (`ADMIN-QUERYCLIENT-PROVIDER`) and finish its tenant guarding (scoped query keys + clear-on-switch). Nothing else matters until the detail opens reliably.
- [ ] **PROJ-2 · TASK-STATUS-CONSISTENCY** 🟧 — **CANONICAL RESOLVED (Planner verified in `DatabaseClone.tsx`, 2026-07-26): the tasks property is `prop-task-status` (name "Status") with options `t-todo` / `t-prog` ("Busy") / `t-done` ("Done").** The `opt-to-do` / `opt-in-prog` / `opt-done` / `opt-hold` set belongs to a DIFFERENT property, **`prop-execution-status`** ("Execution Status") — it is NOT the task status. ⚠️ Therefore: `ProjectDetailView` (L160-161, `t-done`/`t-prog`) is **CORRECT and must not be changed**; `ProjectCockpit` (L36/63/119, `opt-*`) is **the bug** — it reads execution-status option IDs against task records, so its counts/progress are always wrong. FIX: change ONLY `ProjectCockpit` to `t-*`, and read the option IDs from the `prop-task-status` schema rather than hardcoding. Do NOT "standardize" on `opt-*` — that would break the working component. Verify: task counts + progress match reality in both the cockpit and the detail, cross-checked against the tasks grid.
- [ ] **PROJ-3 · FINANCIAL TRUTH** 🟧 — quoted = sum of ALL linked quotes + addendums (**NOTE: the first-only `.find` bug is already FIXED** — `ProjectDetailView.tsx:192` now uses a plural `linkedQuotations` memo + `forEach`; verify rather than rebuild); invoiced = sum of connected invoice RECORDS (not vorderingenstaten) — **this half is still open**; add **forecast margin** per the margin decision below. ⚠️ **The committed-cost layer CANNOT be built yet — there is no PO table** (`db-client-pos`/`db-po` do not exist; the PO module is spec-only). Render committed cost as a **zero/placeholder gated on the PO module**, do not fabricate it. Forecast margin degrades gracefully to `contract − actual` until POs exist, then picks up committed cost with no formula change.
- [ ] **PROJ-4 · DOCUMENTS PANEL + ROLLUP** 🟦 — `PROJ-DOC-ROLLUP` (`coral-purchase-orders.md` Part 3): one panel listing every linked document with status + amount, each opening its record; the revenue/cost ladders above it. Reads from the relations that already exist on the project.
- [ ] **PROJ-5 · COCKPIT COMPLETE** 🟧 — finish `ProjectCockpit` into the command-center view: the live margin (quoted vs realized), revenue + cost ladders (with committed cost), progress %, budget-spent %, doc-status summary, crew-on-project. Match a real "is this project healthy" glance. (Reconfirm the layout with Florin — he flagged the current one doesn't match intent.)
- [ ] **PROJ-6 · CREW & HOURS** 🟧 — surface on the project: scheduled shifts (who's assigned, when) + **actual clocked labour hours & cost vs quoted labour** (data already aggregated: `actualLaborHours`, `quotationFinancials.avgLabourRate`). Ties the WorkHub/scheduler to the project (the WorkHub↔project link Florin has long wanted).
- [ ] **PROJ-7 · LIST VIEW** 🟨 — the projects list is the generic grid + type tabs (Operations/Admin/BizDev). Add at-a-glance **health columns**: status, % complete, margin, invoiced/quoted, deadline — so the list is a portfolio dashboard, not a raw table. (Could ride the mobile stacked-card + database work.)

## CODER Q&A RESOLVED (2026-07-25)
- **Tenant guarding mechanism:** no `['resource', tenantId]` convention exists (React Query barely used — only `useClockEntries`, key `['clock-entries']`, untagged). `AdminLayout.tsx:152` already calls `queryClient.clear()` on tenant change. Do **BOTH**: keep the hard clear (extend to logout + impersonation start/stop) AND namespace keys by tenant (`['clock-entries', tenantId]`, and any new rollup query) — the clear alone can't stop an in-flight A-tenant query resolving into the cleared cache under a tenant-agnostic key. Standardize the key convention now (tiny adoption).
- **Ordered/contract revenue:** no `db-client-pos`/`db-po` table exists; PO module is unbuilt (spec only). Build PROJ-3/5 with **contract revenue = accepted-quote total (all quotes + addenda)**; treat the "Ordered (PO-in)" revenue rung as future-gated on the PO module — omit or placeholder until PO-in is its own DB.
- **Project list grid = `DatabaseClone.tsx`** (dynamic, `databaseId="db-1"`, `defaultFilter` on `prop-project-type`, `onOpenRecord`) — generic NotionGrid renderer, NOT a custom component, NOT `DatabaseList.tsx`. PROJ-7 health columns therefore ride the generic grid → need either real stored props on `db-1` kept current, or a computed/rollup-column capability added to `DatabaseClone`. Decide that fork before PROJ-7; it doesn't block PROJ-1→6.

## DEPENDENCIES / NOTES
- **Depends on** the connected relations being right: `PROJECT-TOTALS-AGGREGATE`, the PO module (`coral-purchase-orders.md` — committed cost), `PROJECT-LOCATION-FIELD` (clickable site nav).
- **Tenant guarding:** the detail reads across many databases (tasks, quotes, invoices, expenses, payments, shifts) via the store — all already tenant-scoped by hydration, but any NEW server query added for the rollup must be `WHERE tenantId = <session>` (standing rule).
- **Reuses, doesn't rebuild:** the aggregation logic largely exists in `ProjectDetailView`; fix and complete it, don't fork a parallel module.

## DECISIONS RESOLVED (Florin "go for it", 2026-07-22)
- **Lifecycle status set:** `lead → won → in-execution → completed → closed`, with off-ramps `on-hold` and `lost/cancelled`. **`invoiced` is NOT a lifecycle stage** — Belgian progress billing (vorderingenstaten) runs in parallel with execution, so a project is in-execution and partially invoiced simultaneously. Billing/payment status lives in the cockpit financial ladders, not the lifecycle. Transitions: **accepted quote → `won`** (auto); first shift/clock-in or manual start → `in-execution`; all tasks done (or manual) → `completed`; manual → `closed` (archived once fully billed + paid). Only accepted-quote→won auto-fires; rest manual. (Coder: add a `status` select on `db-1` with these options if not present; wire the accepted-quote auto-transition.)
- **Margin definition (the headline number) — FORECAST-AT-COMPLETION (EAC), not spent-to-date.** `contract − (actual + committed)` overstates margin early (10% into the job you've spent 10% → shows ~90% "margin"; useless). The live headline = **forecast margin = contract revenue − forecast-cost-at-completion**, where **forecast cost = actual + committed + (budget − actual − committed) for not-yet-committed scope** — i.e. assume the untouched scope finishes on budget, and let overruns/over-commitments erode it. Early in the job this ≈ quoted margin; it degrades the moment cost runs ahead of budget. Contract revenue = ordered (client PO-in) if present, else accepted-quote total (all quotes + addenda). Show THREE: **Quoted margin** (target: quoted − budget) · **Forecast margin €/%** (the headline) · **Realized margin** (invoiced − paid-cost, cash reference). NOTE: if formal client POs are rare, anchor contract = accepted-quote total and drop the "ordered" revenue layer.
- **Cockpit layout:** mocked up for Florin to confirm (see chat mockup `project_cockpit_layout`). Target = hero row (Live Margin €/%, Progress %, Cost/Budget %, Timeline %) → Revenue ladder (Quoted→Ordered→Invoiced→Paid) + Cost ladder (Budget→Committed→Actual→Paid) → Tasks-by-status + Crew/hours (actual vs quoted labour) + Documents summary. Build PROJ-5 to the confirmed mockup.
