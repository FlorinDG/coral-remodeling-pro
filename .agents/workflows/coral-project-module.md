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

## BUILD PLAN (ordered)
- [ ] **PROJ-1 · ACCESS** 🟥 — verify the crash is gone (`ADMIN-QUERYCLIENT-PROVIDER`) and finish its tenant guarding (scoped query keys + clear-on-switch). Nothing else matters until the detail opens reliably.
- [ ] **PROJ-2 · TASK-STATUS-CONSISTENCY** 🟧 — `ProjectDetailView` L160-161 uses `t-done`/`t-prog`; `ProjectCockpit` L36/63/119 uses `opt-done`/`opt-in-prog`/`opt-to-do`. One is wrong → progress %/counts lie. Reconcile to the SINGLE canonical status-option set from the tasks DB schema (`DatabaseClone`), fix both components to read it, and never hardcode divergent ids. Verify: task counts + progress match reality in both the cockpit and the detail.
- [ ] **PROJ-3 · FINANCIAL TRUTH** 🟧 — implement `PROJECT-TOTALS-AGGREGATE`: quoted = sum of ALL linked quotes + addendums; invoiced = sum of connected invoice RECORDS (not vorderingen); add the **committed-cost** layer (open PO-out) and **realized margin**. This is the P&L that makes the module worth opening.
- [ ] **PROJ-4 · DOCUMENTS PANEL + ROLLUP** 🟦 — `PROJ-DOC-ROLLUP` (`coral-purchase-orders.md` Part 3): one panel listing every linked document with status + amount, each opening its record; the revenue/cost ladders above it. Reads from the relations that already exist on the project.
- [ ] **PROJ-5 · COCKPIT COMPLETE** 🟧 — finish `ProjectCockpit` into the command-center view: the live margin (quoted vs realized), revenue + cost ladders (with committed cost), progress %, budget-spent %, doc-status summary, crew-on-project. Match a real "is this project healthy" glance. (Reconfirm the layout with Florin — he flagged the current one doesn't match intent.)
- [ ] **PROJ-6 · CREW & HOURS** 🟧 — surface on the project: scheduled shifts (who's assigned, when) + **actual clocked labour hours & cost vs quoted labour** (data already aggregated: `actualLaborHours`, `quotationFinancials.avgLabourRate`). Ties the WorkHub/scheduler to the project (the WorkHub↔project link Florin has long wanted).
- [ ] **PROJ-7 · LIST VIEW** 🟨 — the projects list is the generic grid + type tabs (Operations/Admin/BizDev). Add at-a-glance **health columns**: status, % complete, margin, invoiced/quoted, deadline — so the list is a portfolio dashboard, not a raw table. (Could ride the mobile stacked-card + database work.)

## DEPENDENCIES / NOTES
- **Depends on** the connected relations being right: `PROJECT-TOTALS-AGGREGATE`, the PO module (`coral-purchase-orders.md` — committed cost), `PROJECT-LOCATION-FIELD` (clickable site nav).
- **Tenant guarding:** the detail reads across many databases (tasks, quotes, invoices, expenses, payments, shifts) via the store — all already tenant-scoped by hydration, but any NEW server query added for the rollup must be `WHERE tenantId = <session>` (standing rule).
- **Reuses, doesn't rebuild:** the aggregation logic largely exists in `ProjectDetailView`; fix and complete it, don't fork a parallel module.

## OPEN DECISIONS (Florin)
- **Lifecycle status set** — confirm the project stages (lead → won → in-execution → completed → invoiced → closed?) and where the transitions fire (e.g. accepted quote → in-execution).
- **Cockpit layout** — you flagged the current one doesn't match intent; sketch/confirm the target so PROJ-5 builds to it, not guesswork.
- **Margin definition** — realized margin = revenue(invoiced or ordered?) − (actual + committed cost)? Confirm which revenue figure anchors the live margin.
