# CORAL — CODER REPORT — LOC-HR-1

### 0 · Header
```
Item:            LOC-HR-1
Directive:       .agents/plans/LOC-HR-1.md
Start SHA:       7db5186b3bd96df1d17e5fc1e89ff40450b8087d
Branch:          develop
Date:            2026-10-08
```

---

### 1 · Outcome
`DONE — LOC-HR-1 executed, verified, and committed. Full localization of the entire HR module across all 4 supported locales (en, nl, fr, ro). All hardcoded Dutch and English strings across HR tabs, dashboards, leave management, employee directory, timesheets, manual entry modals, werkbon documents, schedule matrix/table views, shift status pills/dots, and the shift creation/editing dialogs have been replaced with canonical Hr.* translation keys. Full key parity was achieved and maintained across src/messages/{en,nl,fr,ro}.json. A throw-proof test was added to tests/i18n.test.ts asserting that dropping any Hr.* key triggers failure in both parity and source reference checks. All tests pass (7/7 in i18n suite, 627+ overall) and TypeScript compilation compiles cleanly with 0 errors.`

---

### 2 · Key Additions & Changes

#### 1. Translation Dictionaries (`src/messages/{en,nl,fr,ro}.json`)
- Added canonical dictionaries under `Hr.*`:
  - `Hr.tabs`: `dashboard`, `scheduler`, `timesheets`, `leave`, `employees`
  - `Hr.dashboard`: metrics, counters, status breakdowns, quick actions, recent activity descriptions
  - `Hr.leave`: metrics, status labels, empty states, table columns, action buttons, toasts, and absence reason types (`vacation`, `sick`, `unpaid`, `circumstantial`, `training`, `other`)
  - `Hr.employees`: directory header, search/role/status filters, empty state, detail drawer, tenure calculations, add/edit employee dialogs
  - `Hr.timesheets.manualEntry`: modal titles, employee/project/date/time inputs, error/success toasts
  - `Hr.werkbon`: work order report headers, client signature section, material usage summary, hours formatters
  - `Hr.scheduler`: table/matrix view controls, date navigators, summary period statistics, copy week toasts, mobile notices
  - `Hr.shifts`:
    - `status`: `scheduled`, `late`, `inProgress`, `completed`, `cancelled`
    - `roles`: `crew`, `lead`, `supervisor`, `driver`, `helper`, `none`
    - `create`: single/recurring/leave mode toggles, template selectors, multi-employee picker, project/client selects, date/time inputs, descriptions, materials checkbox, save template options, conflict warnings, submit buttons, success/error toasts
    - `edit`: worker/project selects, date/time inputs, role and status dropdowns, work order notes, site address, materials toggle, recurring expansion config, series scope picker, save/delete buttons, signed locks, toasts
    - `lock`: work order lock banner and signed audit metadata
    - `attachments`: upload button, project file selector, file empty state
    - `tasks`: add project task popover, quick create input, assigned task list, empty state, action buttons

#### 2. HR Views & Components Localized
- `src/config/tabs.ts` & `src/components/admin/ModuleTabs.tsx`:
  - Added `getHrTabs(t?, tHas?)` and wired dynamic `Hr.tabs` localization for `groupId === 'hr'`.
- `src/app/[locale]/admin/hr/page.tsx`:
  - Replaced hardcoded dashboard strings with `Hr.dashboard.*`.
- `src/app/[locale]/admin/hr/leave/page.tsx` & `LeaveActions.tsx`:
  - Replaced hardcoded strings with `Hr.leave.*`.
- `src/app/[locale]/admin/hr/employees/page.tsx`:
  - Replaced directory, filters, dialogs, and tenure strings with `Hr.employees.*`.
- `src/app/[locale]/admin/hr/timesheets/ManualEntryModal.tsx`:
  - Replaced modal strings with `Hr.timesheets.manualEntry.*`.
- `src/app/[locale]/admin/hr/timesheets/[id]/page.tsx` & `WerkbonDocument.tsx`:
  - Replaced print and werkbon report strings with `Hr.werkbon.*` using locale-aware `date-fns` formatting.
- `src/app/[locale]/admin/hr/time-tracker/schedule/page.tsx`:
  - Replaced page headers and mobile notice with `Hr.scheduler.*`.
- `src/components/time-tracker/components/schedule/shift-status-ui.ts`:
  - Preserved color constants; added `getShiftStatusLabel(status, t?)` supporting `Hr.shifts.status`.
- `src/components/time-tracker/components/admin/ScheduleManagement.tsx`:
  - Replaced view toggles, unassigned shift labels, and toasts with `Hr.scheduler.*`.
- `src/components/time-tracker/components/schedule/ScheduleTable.tsx` & `ScheduleMatrixView.tsx`:
  - Replaced headers, date/time headers, filter pills, daily totals, absence cards, and copy-week strings with `Hr.scheduler.*` and `Hr.shifts.*`.
- `src/components/time-tracker/components/schedule/shift-editor/components/ShiftLockBanner.tsx`:
  - Localized with `Hr.shifts.lock.*`.
- `src/components/time-tracker/components/schedule/shift-editor/components/ShiftAttachmentsTab.tsx`:
  - Localized with `Hr.shifts.attachments.*`.
- `src/components/time-tracker/components/schedule/shift-editor/components/ShiftTasksTab.tsx`:
  - Localized with `Hr.shifts.tasks.*`.
- `src/components/time-tracker/components/schedule/shift-editor/CreateShiftForm.tsx`:
  - Fully localized modal tabs, recurrence, templates, leave reasons, inputs, day labels, conflicts, and submit toasts using `Hr.shifts.create.*` and `Hr.shifts.*`.
- `src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx`:
  - Fully localized form fields, status dropdown with `getShiftStatusLabel`, recurring conversion, delete confirmation, and update toasts using `Hr.shifts.edit.*` and `Hr.shifts.*`.

#### 3. Test Guard (`tests/i18n.test.ts`)
- Upgraded `referencedKeys` to accurately bind translation variables (`t`, `tShifts`, `tLeave`, etc.) to their respective namespaces.
- Added throw-proof test suite (`i18n — Hr.* throw proof guard`) verifying:
  1. Dropping any `Hr.*` key fails the key parity check across locales.
  2. Dropping any `Hr.*` key referenced in source fails the source reference test.

---

### 3. Fencing Compliance
- Strict presentation-only boundary respected:
  - No edits to backend API routes (`src/app/api/hr/**`).
  - No edits to database records (`src/lib/records/**`).
  - No edits to kernel business logic (`src/lib/kernel/**`).
  - No edits to fenced hooks (`src/components/time-tracker/hooks/**`).

---

### 4. Verification
- `npm run test:compile`: **0 errors** (clean compile).
- `node --import ./tests/register.mjs --test tests/i18n.test.ts`:
  - **7/7 tests passed**, 0 failed.
- Parity verified across all 4 locales: `en`, `nl`, `fr`, `ro`.
