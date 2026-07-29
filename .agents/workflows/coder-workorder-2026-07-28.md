# CODER WORK ORDER — 2026-07-28 (supersedes the 07-26 order)

Work top-down. Each batch is a commit boundary; verify before starting the next. Detail lives in the linked specs — this file is the order of operations and the acceptance bar.

## ✅ CLOSED SINCE THE LAST ORDER — do not redo
| Item | Evidence |
|---|---|
| **OCC-14** — server returned an `updatedAt` it never persisted (`@updatedAt` regenerates) ⇒ *every* save entered the merge path | fixed; deleting/editing lines no longer conflicts |
| **OCC-15** — sync queue had no single-flight lock ⇒ concurrent saves trampled each other's baseline (only showed up while typing) | fixed — *"nailed it"* |
| **OCC-10 / 13** — invisible `Resolve & Save` (undefined `bg-brand-600`); conflict response now returns the server baseline and hydrate splits content from baseline | landed |
| **Schema** — 6 `ClockEntry` columns present (`projectId`, `billable`, `source`, `costRateApplied`, `costRatePrevious`, `createdBy`), all nullable/defaulted | verified in prod |
| **Worker-identity backfill** | `0` rows keyed by `Employee.id` in either table; 66/69 shifts + 19/22 entries resolve to a `User` |
| **Timesheets i18n** | `Hr.timesheets.*` keys added; labels render |
> ⚠️ OCC-9/11/12 were real hardening but were **not** the cause. Leave them in place; don't revisit the blocks comparison.

---

# BATCH 1 — PEOPLE CAN'T USE THE APP 🟥🟥

### 1.1 · WorkHub: only admins see shifts
`ground-zero-triage.md` → **WORKHUB-SHIFTS-FILTERED-BY-EMPLOYEE-MAP**.
`useScheduledShifts.ts:133-136` filters shifts to those whose `userId` is in a client-built `employeeMap`, and `:105` builds that map from `hrList('employees')` wrapped in **`.catch(() => [])`**. Workforce users can't list the roster ⇒ empty map ⇒ **every shift dropped**. Admins can ⇒ they see everything. **The data is correct — verified in prod; do not touch it.**
- Stop filtering by `employeeMap`; use it only for the display name (`Onbekend` fallback).
- **Durable fix:** return `userName` from the `shifts` API server-side, mirroring `api/hr/[entity]/route.ts:275-280` which already does it for `clock-entries`. Then there's no client-side join to fail.
- Don't swallow the employees error — surface it.
- **Sweep:** any `.catch(() => [])` whose result is used to *filter* rather than *decorate*.
- Verify: Andrei and Vasile each see their own shifts with correct times; admin still sees all; breaking the employees endpoint leaves shifts rendering with `Onbekend`.

### 1.2 · Timesheets: owner sees only their own hours
`coral-timesheets-page.md` → **TSP-B1**. `timesheet-reports/route.ts:36,60` applies `where.userId = { in: getAccessibleUserIds(...) }` **unconditionally**, and that helper returns only the caller's own id unless they lead an `HrTeam`. So a TENANT_OWNER is scoped like a workforce user. Mirror the bypass that already exists at `api/hr/[entity]/route.ts:111-116`: admin ⇒ all tenant users · team lead ⇒ their team · workforce ⇒ self.
**Audit `timesheet-export` for the same omission** — an export silently containing only your own hours is worse than an empty one, because it looks complete.

---

# BATCH 2 — TIMESHEETS PAGE 🟧
Spec: `coral-timesheets-page.md` (layout section is **revised** — read it fresh).
- **2.1 Layout density (TSP-B-layout):** two bands then the table. Header row = title · **4 stats inline, restyled compact — not the current bordered cards** · buttons. One filter card holding period/worker/project/billable/source **plus** the status chips and grouping toggle. Table starts within the first screenful, sticky header.
- **2.2 TSP-B3** — custom date-range picker in the Period control, **reusing `src/components/ui/CustomDatePicker.tsx`**. No third calendar component.
- **2.3 TSP-B4** — default to **this month** (not this week: on a Monday it reads as breakage), and distinguish **three** empty states: request failed · no entries at all · **no entries in this period but N exist outside it** (+ one-click widen).
- **2.4 TSP-4/5/6** — grouping + subtotals; approvals complete (reason flags `late`/`manual`/`off-geofence`/`missing clock-out`, approver + timestamp columns, reversible, bulk with explicit confirmation); export wired to the real endpoint (XLSX works today; add CSV via papaparse, PDF via `@react-pdf/renderer`) inheriting the active filters, with the filter set printed in the file header.
- **2.5 TSP-7 — LAST:** delete `timesheets/reports/` and `timesheets/approvals/` + their `hrTabs` entries. **Keep all three APIs.** Never delete before the replacement works.

---

# BATCH 3 — DATA HYGIENE 🟨
- **3.1 Six orphan rows** — 3 shifts + 3 clock entries whose `userId` matches neither a `User` nor an `Employee`. They must **render** (worker `Onbekend`) rather than vanish, or on-screen totals silently disagree with the database. Then resolve manually: reassign or delete deliberately.
- **3.2 (Florin, ops)** — extend the Neon **PITR window beyond 6 h** and set a **snapshot schedule** (currently manual; newest was ~1 day old during the incident).

---

# BATCH 4 — SCHEDULER 🟧
`ground-zero-triage.md` → SCHEDULER section. Order matters:
1. **LEAVE-MODEL-DUPLICATION first** — `TimeOffRequest` (ranges + approval) vs `ScheduledShift{status:'leave'}` (single-day). Make `TimeOffRequest` canonical; admin leave writes an auto-approved request; the scheduler renders those as absence blocks — which also delivers `SCHED-ABSENCE-IN-GRID`.
2. **SCHED-SERIES-ID** — `seriesId String?` (additive, indexed) + scope flyout *This occurrence · This and following · Entire series* (**radios**, default least-destructive). **Build ONE reusable scope-picker**, shared with TS-8.
3. **SCHED-CONVERT-TO-RECURRING** — with a preview count.
4. **SCHED-DATE-RANGE** — ranges for leave and shifts; **weekends skipped by default with an "include weekends" toggle**; always show day count + actual dates before writing.

---

# ALSO OPEN (not sequenced here)
`coral-engine-dnd.md` — the **invoice** engine pair (RULE 0 atomicity; watch the prefixed droppable ids and the **`modal-` portal** risk; credit-notes share the engine).
`coral-project-module.md` — PROJ-1..7 (**PROJ-2 canonical task status is `t-*`, NOT `opt-*`**).
`coral-timesheet-reporting.md` — TS-3 (`ClockEntry.projectId`), TS-8 (cost rate + scope flyout), TS-4/5.
`coral-calendar.md` — CAL-0 tenant hardening first, then the Google connect flow (the actual blocker).
`coral-invoice-protest.md` + `coral-invoice-protest-strings-en.md` — awaiting NL/FR translations from Florin.
`coral-receipt-bulk.md` Part 5 — email-to-inbox intake (Resend inbound; MX on a subdomain).

---

# 🔒 TENANT + GATING — APPLIES TO EVERY ITEM ON THIS ORDER
Florin, 2026-07-28: *"make sure ALL OF THIS is multi-tenant capable and properly gated."*
**Run `pd.md` → TENANT + GATING CHECKLIST (12 points) against every feature before calling it done.** Not a per-spec paragraph to skim — a list to answer.
Highest-risk surfaces in the current queue, each already a past or potential breach:
- **Timesheet reports / exports** — fan-out over many tables; exports must inherit the caller's RBAC scope.
- **Approved-hours edit unlock** — a **per-tenant** setting with a **server-side** expiry check; never global, never trusted from the client.
- **Entry detail** — locations, photos and documents served via the authenticated file route with a tenant check.
- **Cost rates** — owner/admin only, server-enforced, never visible to a foreman in a column or an export.
- **Article library + supplier prices** — search and creation strictly tenant-scoped; never suggest another tenant's articles.
- **Protest mail** — the attached invoice must belong to the sending tenant; recipient resolved from that tenant's supplier record.
- **Scheduler** — synthetic absence records inherit the same scoping as real shifts.
- **Date range picker / filter state** — URL params are fine, but the API must still derive tenant from the session.

# STANDING RULES (from `pd.md` — these now bind)
1. **Read back every file you edit** before reporting it done; check your own imports, hook imports, declaration order, dangling references, JSX balance, prop call-sites. Then `tsc --noEmit` + lint. **Report what you verified, not what you intended.** If an edit was truncated, say so and stop.
2. **No agent runs any schema-mutating Prisma command** (`db push`, `migrate *`, `--force-reset`, `--accept-data-loss`) against any database. Emit reviewable SQL / a migration file; Florin runs it. **`--accept-data-loss` is a stop sign, not a convenience flag** — additive columns never need it.
3. **DB column first, deploy second.** The reverse took the app down on 07-27.
4. **Fail loudly.** No `.catch(console.error)` or `.catch(() => [])` on user-visible actions — today's two worst bugs were both silent failures producing wrong data.
5. **Absence of state ≠ never configured.** Don't infer user intent from missing data during hydration.
6. **When a guard fires repeatedly, read the runtime evidence before re-modelling the mechanism.** Four OCC theories were built from source while the server was logging the answer on every conflict.
