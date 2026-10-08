# PLAN — LOC-HR-1 · Full Localization of the HR Module

### 0 · Header
```
Item:            LOC-HR-1 (HR MVP Close Step 2/5)
Directive:       .agents/workflows/CODER-QUEUE.md (§6 · LOC-HR-1)
Workspace:       coral-remodeling-pro
Branch:          develop
Date:            2026-10-08
Status:          PLAN DRAFTED — Awaiting Review & GO
```

---

### 1 · Objectives & Invariants
- **Goal:** Replace all hard-coded Dutch and English strings across the HR module with canonical `Hr.*` translation keys in all 4 supported locales (`nl.json`, `en.json`, `fr.json`, `ro.json`).
- **Invariants:**
  1. **Strings only:** NO logic, state management, or component lifecycle changes.
  2. **Formatters preserved:** Dates and currency use existing locale-aware formatters — no new raw `toLocaleDateString('en-US')`.
  3. **Colors preserved:** `shift-status-ui.ts` maps `label` to `Hr.shifts.status.*` translation keys while keeping Tailwind color tokens untouched.
  4. **Key Parity & Existence:** Every referenced key must exist in all 4 message files (`en`, `nl`, `fr`, `ro`). Verified by `tests/i18n.test.ts` with explicit throw proof.

---

### 2 · Audited Target Files & Scope

#### 2.1 · HR Admin Pages (`src/app/[locale]/admin/hr/**`)
1. `src/app/[locale]/admin/hr/page.tsx` (HR Dashboard: stats, metrics, quick actions)
2. `src/app/[locale]/admin/hr/leave/page.tsx` & `LeaveActions.tsx` (Leave requests, approval dialogs, status filters)
3. `src/app/[locale]/admin/hr/employees/page.tsx` (Employees list, profile card, search)
4. `src/app/[locale]/admin/hr/timesheets/page.tsx`, `[id]/page.tsx`, `TimesheetFilterBar.tsx`, `ManualEntryModal.tsx`
5. `src/app/[locale]/admin/hr/time-tracker/schedule/page.tsx` (Workforce Scheduler container)

#### 2.2 · Workforce Scheduler & Shift Editor (`src/components/time-tracker/components/schedule/**`)
6. `src/components/time-tracker/components/admin/ScheduleManagement.tsx` (Scheduler toolbar, week switcher, view toggles)
7. `src/components/time-tracker/components/schedule/ScheduleMatrixView.tsx` (Matrix headers, employee rows, empty slots)
8. `src/components/time-tracker/components/schedule/ScheduleTable.tsx` (Table columns, filter bar, shift rows)
9. `src/components/time-tracker/components/schedule/shift-editor/CreateShiftForm.tsx` & `EditShiftDialog.tsx`
10. `src/components/time-tracker/components/schedule/shift-editor/components/ShiftAttachmentsTab.tsx`, `ShiftTasksTab.tsx`, `ShiftLockBanner.tsx`
11. `src/components/time-tracker/components/schedule/shift-status-ui.ts` (Status badge labels)

#### 2.3 · Werkbon Document (`src/components/time-tracker/components/werkbon/**`)
12. `src/components/time-tracker/components/werkbon/WerkbonDocument.tsx` (Work order print view, signatures, notes)
13. `src/components/time-tracker/components/werkbon/WerkbonCard.tsx` (Preview card)

#### 2.4 · Module Tabs (`src/config/tabs.ts`)
14. `src/config/tabs.ts` (`hrTabs` and `getHrTabs(t?, tHas?)` localization helper matching `getFinancialTabs`)

---

### 3 · Translation Schema (`Hr.*`) across `en.json`, `nl.json`, `fr.json`, `ro.json`

The new keys will be organized under the `Hr` root object:
```json
{
  "Hr": {
    "tabs": {
      "dashboard": "HR Dashboard",
      "scheduler": "Workforce Scheduler",
      "timesheets": "Timesheets",
      "leave": "Leave Management",
      "employees": "Employees"
    },
    "dashboard": { ... },
    "employees": { ... },
    "leave": { ... },
    "timesheets": { ... },
    "scheduler": { ... },
    "shifts": {
      "status": {
        "scheduled": "Scheduled",
        "inProgress": "In Progress",
        "completed": "Completed",
        "cancelled": "Cancelled",
        "draft": "Draft"
      },
      ...
    },
    "werkbon": { ... }
  }
}
```
- **Dutch (`nl.json`):** Matches today's active wording.
- **English (`en.json`):** Natural idiomatic English.
- **French (`fr.json`) & Romanian (`ro.json`):** Full translations, with ambiguous HR terms flagged in the report.

---

### 4 · Execution Phases (Atomic Milestones)

- **Phase 1 · Dictionary & Tabs:**
  - Add all `Hr.*` keys in lockstep to `en.json`, `nl.json`, `fr.json`, and `ro.json`.
  - Update `src/config/tabs.ts` to export `getHrTabs` and update consumers.
- **Phase 2 · Admin Pages:**
  - Update `admin/hr/page.tsx`, `leave/page.tsx`, `leave/LeaveActions.tsx`, `employees/page.tsx`, and `timesheets/**`.
- **Phase 3 · Scheduler, Shift Editor & Werkbon:**
  - Update `ScheduleManagement.tsx`, `ScheduleMatrixView.tsx`, `ScheduleTable.tsx`, `shift-status-ui.ts`, shift editor dialogs/tabs, and `WerkbonDocument.tsx`.
- **Phase 4 · Verification & Guard:**
  - Run `npm run test:compile` (0 errors).
  - Run `node --import ./tests/register.mjs --test tests/i18n.test.ts`.
  - Add throw proof in test suite demonstrating that missing an `Hr.*` key triggers failure.
  - Full regression run (`tests/*.test.ts`).

---

### 5 · Next Action
Awaiting review and **GO** from Florin to begin Phase 1.
