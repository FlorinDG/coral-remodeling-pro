# CODER DIRECTIVE — DB-HEADER-1 · one database header across the ERP — PLAN REQUEST

**Planner 2026-10-05. Gate 1 only: write the PLAN (`.agents/plans/DB-HEADER-1.md`) per `coder-report-protocol.md`
§0, push, STOP.** §3a (THROW PROOF) and §3b (a fence is a wall) are binding.

## Why (Florin 2026-10-05)
"make sure the db headers are consistent throughout the erp, because now they are not. canonical logic here must
reign." 19 screens render a database (`DatabaseClone` / `NotionGrid`). Their headers are assembled per page:
- some pages draw their OWN action bar above the grid (tickets: scan / bulk / manual; purchase invoices: scan,
  Peppol badge; CRM: pipeline tabs hardcoded as "Main Pipeline" / "Bobex Pipeline"; projects: type tabs);
- the grid toolbar decides its buttons ad hoc (`NotionGrid.tsx` ~595–640: Properties, Filter, Sort, Export,
  accountant export by role, bulk approve on the expenses inbox, Import…);
- `DatabaseClone` adds view tabs (unless `hideViewTabs` — CRM hides them, so its filters cannot be split per view)
  and the "Edit custom fields / Edit schema fields" pill (~449).

## 🔴 Canonical logic — kernel → core → seraph
- **ONE pure rule decides the header** — e.g. `src/lib/records/db-header.ts`:
  `databaseHeader(ctx) → { screenTabs, viewTabs, toolbar: ToolbarItem[], actions: ActionItem[], schemaLink }`,
  from the database's ROLE (logicalKey — never its id), the screen (VIEW-SCOPE-1 `surfaceKey`), the user's role,
  plan / modules. No page decides a button by itself. Existing rules are REUSED, not copied:
  `canRunAccountantExport`, `ACCOUNTANT_EXPORT_SOURCES`, `systemDatabaseEntitled`, `isTenantDatabase`.
- **One header component** renders that result; every database screen uses it. Page-specific actions (scan, bulk
  upload, manual ticket, Peppol sync, new project…) are DECLARED in the rule per role and rendered in one slot —
  their handlers stay where they are (passed in), their placement does not.
- **Labels come from data or i18n, never hardcoded**: pipeline tabs are the databases' own names (CRM / Bobex);
  every visible string through `next-intl`.
- Tests: the rule is pure → `tests/db-header.test.ts`, every test with a throw proof (node:test).

## Your plan must contain
1. **Inventory** — all 19 screens (file:line): what each header shows today (screen tabs, view tabs, toolbar
   buttons, page action bar, schema pill, title), in one table. Mark every inconsistency.
2. The rule's signature and its table: which role / screen / user role / plan gets which item. Where today's
   behaviour differs between screens of the same role, propose ONE and say which you dropped.
3. The component, and how each of the 19 screens switches to it (milestones; smallest first).
4. What Florin can click through after each milestone.
5. Open questions — especially: should CRM show view tabs (it hides them today)?

## 🛑 FENCE (for the plan stage: read everything, change nothing but the plan file)
Later milestones may create `src/lib/records/db-header.ts`, `tests/db-header.test.ts`, one header component under
`src/components/admin/database/components/`, and change the 19 screens + `DatabaseClone.tsx` / `NotionGrid.tsx`
header parts only. Read-only: `src/lib/data/**`, the kernel, server actions, the store. If you need a change
there: STOP and say so in the plan.
