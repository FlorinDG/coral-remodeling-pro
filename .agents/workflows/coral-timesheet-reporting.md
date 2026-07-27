# CORAL — TIMESHEET REPORTING & DATA EXTRACTION — Planner spec 2026-07-26

**Florin:** *"one crucial detail I'm missing: reporting and data extraction and all the operations with timesheets. Extract for a period, for a worker, connect from the hours table to a project, maybe process the docs/photos attached to werkbon, and so on."*

**Why this matters:** capture without extraction is a dead end. Hours are currently recorded (`ClockEntry`) and approved, but they can't be *reported*, *exported*, or *costed to a project*. That means: no payroll hand-off, no client-billable hours evidence, no actual-labour-cost feed into the project P&L. The tracking is only half a feature until this exists.

---

## 🚧 HARD PREREQUISITE — fix the worker-identity mismatch FIRST
Every report below groups by worker. If the id is wrong, **every report is wrong** — and silently so.
**Confirmed 4th occurrence of the same defect** (see `ground-zero-triage.md` → `WORKHUB-SHIFT-USERID-MISMATCH`):
1. `ManualEntryModal.tsx:88` — `<SelectItem value={emp.id}>` submits the **HrEmployee id** as `ClockEntry.userId`. The resolver (`api/hr/[entity]/route.ts:270-280`) keys `empMap` by `e.userId` and `userMap` by User id, so an employee id matches neither → falls through to `r.userId?.slice(0,8)` → **the raw id fragment Florin sees in the table**. (The werkbon resolves via a different path, hence the correct name there — a useful confirmation, not a fix.)
2. `CreateShiftForm.tsx:799-808` — same, for `ScheduledShift.userId`.
3. Earlier: timesheets `employeeMap`, and the "System" attribution.
**Required before TS-1:** a single shared **`resolveWorkerUserId()`** (and its inverse `resolveEmployeeForUser()`), used by every writer and reader. `ClockEntry.userId` / `ScheduledShift.userId` must contractually hold the **User id**. Plus a dry-run-first, backup-first **backfill** of already-written rows. Do not build reporting on top of an ambiguous key.

---

## DATA MODEL — what we have
- **`ClockEntry`** — `userId`, `clockInTime`/`clockOutTime`, clock-in/out lat-lng, `taskDescription`, `requiresApproval`, `approvalStatus`, `approvedBy`/`approvedAt`, **`shiftId`**, `noBreak`, **`photos Json?`**.
- **`ScheduledShift`** — `userId`, `shiftDate`, `shiftStart`/`shiftEnd`, `shiftName`, **`projectId`**, `role`, `notes`, `status`.
- **`ShiftTask`** (worker progress + `subtasks` + `workerNotes`), **`ShiftAttachment`** (`name`, `url`, `type`, `size`).
- **`TimeOffRequest`**, `HrTeam`/`HrTeamMember`, `WorkerSchedule`, `UserProjectAccess`.
> **The project link already exists — via the shift, not the entry.** `ClockEntry.shiftId → ScheduledShift.projectId`. **Gap:** an entry clocked **without** a shift has NO project (Florin is testing exactly this case). See TS-3.

---

## BUILD PLAN

- [ ] **TS-1 · REPORT QUERY LAYER** 🟥 — one tenant-scoped aggregation endpoint powering every view/export. Filters: **period** (from/to, presets: this week / last week / month / custom), **worker(s)**, **project(s)**, **team**, **approval status**, **entry source** (clocked / manual / adjusted). Returns per-entry rows **and** rollups: hours per worker, per project, per worker×project, per day/week. Compute worked duration server-side (out − in, minus break unless `noBreak`), and surface **open entries** (no `clockOutTime`) explicitly rather than silently counting them as 0 or as "now".
  *Tenant:* `WHERE tenantId = <session>` on every table touched; tenant from session only, never a param.
- [ ] **TS-2 · REPORT UI** 🟧 — a Timesheets → **Reports** tab: filter bar, a grouped/expandable table (worker → day → entries, or project → worker), totals row, and StatCards: **total hours · billable vs internal · approved vs pending**. **NO overtime metric** (decided: not a concept in this system). Row click → the entry detail (map pin, photos, werkbon). Reuse the grid conventions; this is also where `HR-TIMESHEETS-RICH-UI` lands.
- [ ] **TS-2b · APPROVALS OVERVIEW (Florin live: "I can approve and deny hours, but without the general view there is no way to track or confirm these")** 🟥 — approval actions exist but are **write-only**: there is no surface showing what is pending, what was approved/denied, by whom, or when. That makes the approval step unverifiable — and unverifiable approvals are worthless for payroll or a dispute. Build:
  1. **Pending queue** — everything awaiting decision, oldest first, with the reason it needs approval (late entry, outside geofence, manual, missing clock-out), the worker, project, and duration. This is the daily work list.
  2. **Decision history** — approved/denied entries with `approvedBy` + `approvedAt`, filterable by period/worker/approver, and **reversible** (an approval can be withdrawn with a trail, per TS-7).
  3. **Status visible everywhere** — every entry in the report table (TS-2) carries its approval state; totals separate **approved** from **pending** hours so nobody exports unapproved time to payroll by accident.
  4. **Counters** — a pending-approvals badge in the HR nav so the queue can't be silently ignored.
  - Verify: approve one entry and deny another → both appear in the history with approver + timestamp → pending count decrements → the approved one counts toward exportable hours and the denied one does not.
- [ ] **TS-3 · HOURS → PROJECT (the costing link)** 🟥 — make the project attribution reliable:
  1. Entries with a `shiftId` inherit `ScheduledShift.projectId` (already possible).
  2. **Entries without a shift need a project.** Add an explicit **`projectId` on `ClockEntry`** (additive column; nullable), set at clock-in (worker picks/confirms the project) or assigned later by an admin in the report view. Fall back to the shift's project when present.
  3. **Bulk-assign** unattributed entries to a project from the report view.
  4. **Unattributed hours must be visible**, never silently dropped from project cost.
  - Feeds `PROJ-6 CREW & HOURS` and the **actual labour cost** in `PROJ-3` (`actualLaborHours × rate`). Confirm the rate source (per-worker cost rate vs `quotationFinancials.avgLabourRate`) — see decisions.
- [ ] **TS-4 · EXPORTS** 🟧 — from any filtered result:
  - **XLSX** (use the `xlsx` skill conventions): raw entries sheet + pivot sheets (worker×period, project×period). Include entry id, worker, date, in/out, duration, break, project, shift, approval status, approver, source, GPS-verified flag.
  - ~~CSV payroll hand-off~~ — **PARKED** (Partena is handled manually on their own platform; see decisions). Do not build.
  - **PDF** — a signable **prestatiestaat / werkbon** per worker per period, and per project (client-facing evidence of hours).
  - Every export is **tenant-scoped and RBAC-filtered**, logs who exported what, and states the filter set in the header so a printed sheet is self-describing.
- [ ] **TS-5 · WERKBON ATTACHMENTS & PHOTOS** 🟧 — `ClockEntry.photos` and `ShiftAttachment` are captured but not usable in bulk. Build: a **gallery per entry/shift/project/period**; thumbnails in the report row; bulk **download as ZIP** (per project or period); attach selected photos into the **werkbon PDF** (TS-4) as evidence; and push relevant photos through to the **project Files** panel (`PROJ-4`) so site evidence lives with the project. *Storage:* Blob under `t_{tenant}/…` — verify private-blob serving via the authenticated `/api/files/...` route (the same trap as `RECEIPT-BONNETJE-LINK`: never store a bare key in a URL field).
- [ ] **TS-6 · SCHEDULED / RECURRING REPORTS** 🟨 — weekly "hours last week" digest to owner/foreman; monthly payroll pack on a fixed day. Reuses the automations work (`coral-automations-study.md`).
- [ ] **TS-7 · AUDIT & CORRECTIONS** 🟨 — every edit/approval/manual entry is attributable: keep `approvedBy`/`approvedAt`, add `createdBy`/`source` on `ClockEntry` (additive) so a manual entry is distinguishable from a clocked one in every report. Corrections should **amend with a trail**, never silently overwrite — payroll data must be defensible.

- [ ] **TS-8 · COST RATE — STAMPED VALUE + SCOPED EDIT** 🟥 (Florin decision, 2026-07-26)
  **Storage model (this is what makes scoped edits possible):**
  1. **`costRate` on the user/employee** = the *current default*, set at user creation, shown in user settings.
  2. **`costRateApplied` stamped onto every `ClockEntry`** (additive column) at entry creation — copied from the user's current default. **All reporting and project costing read the STAMPED value, never a live lookup.** A live lookup would mean a raise silently rewrites last quarter's project margins.
  3. Keep `costRatePrevious` (or an audit row) per entry so any bulk change is reversible.

  **Edit flow:** editing a rate from the timesheets opens a flyout. **Use RADIOS, not checkboxes** — the scopes are mutually exclusive, and "past + future" as checkboxes just creates a redundant second way to express "all". Four options, with these EXACT semantics (label them unambiguously — "change current" is the one most open to misreading):
  | Option | Precise meaning | Touches |
  |---|---|---|
  | **This entry only** | Restamp just the entry being edited | 1 entry |
  | **From today forward** *(default)* | Update the user's default only; existing entries untouched | 0 entries + user default |
  | **All past entries** | Restamp every entry **before today**; also leaves the default unchanged unless combined | N historical entries |
  | **Everything** | Update the default AND restamp all entries, past and future | all entries + default |
  **Default the radio to "From today forward"** — the only non-destructive choice.

  **Safety (this rewrites financial history — non-negotiable):**
  - **Impact preview before applying:** *"This will restamp **N** entries across **M** projects, changing total labour cost by **€X** (€A → €B)."* Never apply a bulk rate change blind.
  - **Guard already-exported/approved data:** entries already included in an accountant export (reuse the `accountantExportedAt` pattern) require a second, explicit confirmation — changing them alters figures the accountant already has.
  - **Audit row per change:** who, when, old → new rate, scope chosen, affected entry count, resulting cost delta. This is money data and must be defensible.
  - **Reversible:** one-click undo of the last bulk rate change, restoring the previous stamped values.
  - **Data-safety rule applies** (`pd.md`): bulk write on live financial data ⇒ dry-run + count first, backup before write.
  - **RBAC:** only owner/admin may edit rates or even *see* them — a foreman must not see colleagues' cost rates. Enforce server-side.
  - **Recompute downstream:** a restamp changes project actual cost ⇒ PROJ-3 forecast margin moves. Make sure project totals recompute (or invalidate) rather than serving a stale cached margin.
  Verify: set a rate at creation → entries stamp it → raise the rate with "From today forward" → historical reports and project margins are **unchanged**; then "All past entries" → preview shows the exact delta, applying changes history, undo restores it.

---

## 🔒 MULTI-TENANT + RBAC (standing rules)
- Tenant from session; every query and export scoped `WHERE tenantId = <session>`. One unscoped join leaks the whole workforce.
- **Intra-tenant visibility:** `owner/admin` → all workers; `foreman/team lead` → their team only (reuse `getAccessibleUserIds`, which already handles lead→team); `workforce` → **own entries only**. Enforced **server-side in the query layer**, never by hiding UI.
- Exports inherit the caller's RBAC scope — a foreman's "export all" must silently mean "their team," not everyone.
- Photos/attachments served through the authenticated route with a tenant check; never public blob URLs.

## ✅ DECISIONS RESOLVED (Florin, 2026-07-26)
- **Break — auto-deducted, with a "no break taken" checkbox. ALREADY IMPLEMENTED** (`ClockEntry.noBreak` exists). Reports must apply the same deduction rule as the capture side — **compute it in ONE shared function** used by capture, display, and every export, so a report can never disagree with the werkbon. Confirm/centralise the existing threshold rather than re-implementing it.
- **Overtime — NOT a concept in this system. Do not build it.** Report **raw worked hours** only. A calculation sheet/database will derive overtime later. ⇒ **Remove "overtime" from TS-2 StatCards**; no premium logic, no thresholds, no daily/weekly bands anywhere in the reporting layer.
- **Labour cost rate — set PER USER, initially on user creation, editable from the timesheets with an explicit scope choice** (Florin 2026-07-26). See **TS-8** for the full mechanic. Project actual labour cost = `Σ(entry hours × the rate stamped on that entry)`. **Not** the quote's `avgLabourRate` (that remains a quoting estimate).
- **Payroll export — PARKED (moved to `coral-nice-to-have.md`).** Partena Professional provides their own platform and this is done manually on their site. ⇒ **Drop the payroll CSV from TS-4.** TS-4 keeps: **XLSX** (raw + pivots, for his own analysis) and **PDF werkbon / prestatiestaat** (per worker, per project). Revisit only if a Partena import API/template appears.
- **Billable vs internal — at ENTRY level.** The **shift is billable-agnostic**; the **project counts both and keeps track**. ⇒ Add **`billable: boolean`** on `ClockEntry` (additive, defaulted sensibly, editable in the report view + bulk-settable). Every project rollup reports **billable hours, internal hours, and total** side by side — never one number that hides the split. Feeds PROJ-3/PROJ-6.
- **checkin@work / aanwezigheidsregistratie — OUT OF SCOPE.** The statutory system requires physical on-site registration on external infrastructure; the ERP cannot substitute for it. Workers on such projects clock **twice** (theirs + ours) and that is accepted. Florin deliberately structures work to stay under the threshold. ⇒ **Do not build, do not claim compliance, do not surface it in the UI.** Parked in nice-to-have as a *research-only* item: check whether a REST API exists to **download** registrations for import (one-way, into our timesheets) — secondary priority, research before any build.
