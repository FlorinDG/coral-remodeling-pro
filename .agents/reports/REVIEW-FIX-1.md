# REVIEW-FIX-1 Report

### 0 · Header
```
Item:            REVIEW-FIX-1
Directive:       .agents/workflows/coder-directive-review-fix-1.md
Directive blob:  37508b5c2be96d0aceb5ade6dd39a48c4db0e884
Start SHA:       43ae7509424ba7b50875cbe61c92d5e27a7c9d96
End SHA:         e96ff640a33a1e94fc77fbfa11f44d5d9c22262a
Branch:          develop
Date:            2026-10-09
```

### 1 · Outcome
`PARTIAL — A1..C1 complete, tested, and verified; C2 code implemented but test runner blocked by Node 24 strip-types error in fenced src/lib/hr-api.ts:11`

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `eeec5cad` | fix(review-fix-1): A1 — isCalendarDay in the kernel | 1 | +10/−0 |
| `d4eb16f4` | fix(review-fix-1): A2 — employee profile helpers in core | 1 | +71/−0 |
| `06e24e6b` | fix(review-fix-1): A3 — both employee routes use profileOf and profileInput | 2 | +19/−37 |
| `377a1b0e` | fix(review-fix-1): A4 — employee profile tests exercise real kernel and core code | 1 | +126/−199 |
| `cabd1d3b` | fix(review-fix-1): B1 — move CreateIfMissing and RecordMeta to record-intent in core | 7 | +33/−19 |
| `ee49037a` | fix(review-fix-1): B2 — portal task due date is normalised to calendar day | 2 | +43/−2 |
| `3c975758` | fix(review-fix-1): C1 — scheduler date display routes through lib/format/date with no en-US fallback | 2 | +17/−12 |
| `e96ff640` | fix(review-fix-1): C2 — unified projectColorOf resolver in useScheduledShifts | 3 | +23/−22 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| A1 | Kernel `isCalendarDay(v)` checking format and calendar existence with arithmetic | ✅ | `src/lib/kernel/shift-time.ts:168-177` |
| A2 | Core `profileOf` and `profileInput` pure functions in `employee-profile.ts` | ✅ | `src/lib/records/employee-profile.ts:1-71` |
| A3 | GET list uses `...profileOf(u.employee)`, POST/PUT validate `profileInput` and return `profileOf` | ✅ | `src/app/api/tenant/employees/route.ts:84,111,202`, `src/app/api/tenant/employees/[employeeId]/route.ts:36,140` |
| A4 | `tests/employee-profile.test.ts` imports real code and exercises kernel/core with throw proofs | ✅ | `tests/employee-profile.test.ts:1-155` |
| B1 | `CreateIfMissing` and `RecordMeta` moved to `record-intent.ts`; re-exported in `records.ts`; 4 core files import `./record-intent`; import boundary test | ✅ | `src/lib/records/record-intent.ts:20-30`, `src/lib/data/records.ts:17-18`, `tests/portal-export-door.test.ts:248-259` |
| B2 | Portal task due date normalised via `normaliseDateValue` to Brussels calendar day | ✅ | `src/lib/records/portal-export-intents.ts:109,149`, `tests/portal-export-door.test.ts:261-300` |
| C1 | Scheduler date routes through `lib/format/date` (`formatWeekdayDayMonth`); `'en-US'` removed | ✅ | `src/components/time-tracker/components/schedule/schedule-grid-model.ts:54-57`, `tests/scheduler-grid-mapping.test.ts:90-106` |
| C2 | `NOTION_COLORS` deleted in model; exported `projectColorOf` in `useScheduledShifts.ts`; `ScheduleMatrixView.tsx` and model delegate | 🟨 | `useScheduledShifts.ts:30-37`, `ScheduleMatrixView.tsx:43`, `schedule-grid-model.ts:10-14,40`; runtime test blocked by `hr-api.ts:11` (§9) |

### 4 · Files vs blast radius
```
src/app/api/tenant/employees/[employeeId]/route.ts |  25 +-
src/app/api/tenant/employees/route.ts              |  31 +-
.../components/schedule/ScheduleMatrixView.tsx     |   7 +-
.../components/schedule/schedule-grid-model.ts     |  35 +--
.../time-tracker/hooks/useScheduledShifts.ts       |  15 +
src/lib/data/records.ts                            |  12 +-
src/lib/kernel/shift-time.ts                       |  10 +
src/lib/records/actions-record-intents.ts          |   3 +-
src/lib/records/cron-record-intents.ts             |   3 +-
src/lib/records/employee-profile.ts                |  71 +++++
src/lib/records/peppol-scan-intents.ts             |   3 +-
src/lib/records/portal-export-intents.ts           |   8 +-
src/lib/records/record-intent.ts                   |  11 +
tests/employee-profile.test.ts                     | 325 ++++++++-------------
tests/portal-export-door.test.ts                   |  55 ++++
tests/scheduler-grid-mapping.test.ts               |  17 +-
```
*(Note: `.agents/reports/UNATTENDED-LOG.md`, `.agents/tools/coder-cron-gate.sh`, `.agents/workflows/CODER-QUEUE.md`, `.agents/workflows/coder-cron-protocol.md`, `.agents/workflows/planner-unattended.md`, `src/app/api/financials/export/route.ts`, and `tests/save-records-batch.test.ts` were concurrent commits made to `origin/develop` by the Planner between pushes).*

| File | In blast radius? |
|---|---|
| `src/lib/kernel/shift-time.ts` | Yes (A1) |
| `src/lib/records/employee-profile.ts` | Yes (A2) |
| `src/app/api/tenant/employees/route.ts` | Yes (A3) |
| `src/app/api/tenant/employees/[employeeId]/route.ts` | Yes (A3) |
| `tests/employee-profile.test.ts` | Yes (A4) |
| `src/lib/records/record-intent.ts` | Yes (B1) |
| `src/lib/data/records.ts` | Yes (B1 - type moves & re-export only) |
| `src/lib/records/portal-export-intents.ts` | Yes (B1, B2) |
| `src/lib/records/actions-record-intents.ts` | Yes (B1) |
| `src/lib/records/peppol-scan-intents.ts` | Yes (B1) |
| `src/lib/records/cron-record-intents.ts` | Yes (B1) |
| `tests/portal-export-door.test.ts` | Yes (B1, B2) |
| `src/components/time-tracker/components/schedule/schedule-grid-model.ts` | Yes (C1, C2) |
| `src/components/time-tracker/components/schedule/ScheduleMatrixView.tsx` | Yes (C2) |
| `src/components/time-tracker/hooks/useScheduledShifts.ts` | Yes (C2 - export resolver only) |
| `tests/scheduler-grid-mapping.test.ts` | Yes (C1, C2) |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/lib/records/employee-profile.ts:32` | Trimming text in `profileInput` | 1. Raw string only. 2. Trim strings and convert whitespace-only to null. | Option 2: Trim strings and whitespace-only to null. | Prevents storing strings containing only whitespace in database fields. |
| `src/lib/records/employee-profile.ts:25` | Type of `profileInput.data` | 1. `Record<string, unknown>`. 2. `Partial<Record<EmployeeProfileField, string \| null>>`. | Option 2: Strongly typed partial record. | Enforces strict compile-time types when spreading into Prisma queries. |

### 6 · Verification — commands, not descriptions

### VERIFY: npm run test:compile
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY: npm run test:lint
```
$ npm run test:lint; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:lint
> eslint src

exit: 0
```

### VERIFY: tests/employee-profile.test.ts
```
$ node --import ./tests/register.mjs --test tests/employee-profile.test.ts; echo "exit: $?"
✔ EMP-PROFILE-1: isCalendarDay validates real calendar days without timezone shifts (0.492292ms)
✔ EMP-PROFILE-1: profileInput parses body fields, normalises empty to null, preserves absent (0.441166ms)
✔ EMP-PROFILE-1: profileOf maps all 5 profile fields with null defaults (0.088791ms)
✔ EMP-PROFILE-1: Prisma schema and migration define all 5 additive fields on Employee (1.718584ms)
✔ EMP-PROFILE-1: Employees page does not use localStorage for profiles (0.714ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 131.043625
exit: 0
```

### THROW PROOF — A1 / A4 isCalendarDay (tests/employee-profile.test.ts)
```
$ git diff src/lib/kernel/shift-time.ts
--- a/src/lib/kernel/shift-time.ts
+++ b/src/lib/kernel/shift-time.ts
@@ -168,10 +168,6 @@ export function isCalendarDay(v: unknown): v is string {
     if (typeof v !== 'string') return false;
-    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
-    const [y, m, d] = v.split('-').map(Number);
-    if (m < 1 || m > 12) return false;
-    if (d < 1 || d > dim(y, m)) return false;
     return true;
 }

$ node --import ./tests/register.mjs --test tests/employee-profile.test.ts; echo "exit: $?"
✖ EMP-PROFILE-1: isCalendarDay validates real calendar days without timezone shifts (1.070125ms)
✖ EMP-PROFILE-1: profileInput parses body fields, normalises empty to null, preserves absent (0.818541ms)
...
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
true !== false
exit: 1
```

### THROW PROOF — A2 / A4 profileOf notes drop (tests/employee-profile.test.ts)
```
$ git diff src/lib/records/employee-profile.ts
--- a/src/lib/records/employee-profile.ts
+++ b/src/lib/records/employee-profile.ts
@@ -19,8 +19,7 @@ export function profileOf(
         employmentType: employee?.employmentType ?? null,
         address: employee?.address ?? null,
         birthDate: employee?.birthDate ?? null,
-        notes: employee?.notes ?? null,
-    };
+    } as any;

$ node --import ./tests/register.mjs --test tests/employee-profile.test.ts; echo "exit: $?"
✖ EMP-PROFILE-1: profileOf maps all 5 profile fields with null defaults (1.598375ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected
  {
    address: 'Rue de la Loi 16, Bruxelles',
    birthDate: '1992-11-05',
    department: 'Architecture',
    employmentType: 'Freelance',
-   notes: 'Senior Architect'
  }
exit: 1
```

### VERIFY: tests/portal-export-door.test.ts
```
$ node --import ./tests/register.mjs --test tests/portal-export-door.test.ts; echo "exit: $?"
✔ R2-1-B M4: buildAccountantExportStampIntent constructs delta fields with actor metadata and opts.by (0.777917ms)
✔ R2-1-B M4: stamping accountant-exported record succeeds through saveRecord door (1.5725ms)
✔ R2-1-B M4: buildPortalProjectCreateData builds intent and createIfMissing with assignedTo: [] (0.182167ms)
✔ R2-1-B M4: buildPortalTaskCreateData builds task intent with by: portal:client (2.774792ms)
✔ R2-1-B M4: buildPortalTaskUpdateIntent sends strictly delta fields (0.193458ms)
✔ R2-1-B M4: updating a non-existent task yields NOT_FOUND refusal (0.081125ms)
✔ REVIEW-FIX-1 B1: no file under src/lib/records/ imports from lib/data (6.222291ms)
✔ REVIEW-FIX-1 B2: a due date is normalised to Brussels calendar day YYYY-MM-DD (0.345417ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 168.842583
exit: 0
```

### THROW PROOF — B1 door import boundary (tests/portal-export-door.test.ts)
```
$ git diff src/lib/records/portal-export-intents.ts
--- a/src/lib/records/portal-export-intents.ts
+++ b/src/lib/records/portal-export-intents.ts
@@ -9,6 +9,7 @@
 import type { RecordIntent, CreateIfMissing } from './record-intent';
+import type { CreateIfMissing as OldCreate } from '@/lib/data/records';

$ node --import ./tests/register.mjs --test tests/portal-export-door.test.ts; echo "exit: $?"
✖ REVIEW-FIX-1 B1: no file under src/lib/records/ imports from lib/data (5.9055ms)
AssertionError [ERR_ASSERTION]: Files in src/lib/records importing from lib/data: portal-export-intents.ts
+ actual - expected
+ [
+   'portal-export-intents.ts'
+ ]
- []
exit: 1
```

### THROW PROOF — B2 due date toISOString revert (tests/portal-export-door.test.ts)
```
$ git diff src/lib/records/portal-export-intents.ts
--- a/src/lib/records/portal-export-intents.ts
+++ b/src/lib/records/portal-export-intents.ts
@@ -106,7 +106,7 @@
     const properties: Record<string, unknown> = {
         title: input.title,
         'prop-task-status': 'opt-todo',
-        'prop-task-due': input.dueDate ? normaliseDateValue(String(input.dueDate)) : '',
+        'prop-task-due': input.dueDate ? new Date(input.dueDate).toISOString() : '',

$ node --import ./tests/register.mjs --test tests/portal-export-door.test.ts; echo "exit: $?"
✖ REVIEW-FIX-1 B2: a due date is normalised to Brussels calendar day YYYY-MM-DD (0.582125ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected
+ '2026-10-10T00:00:00.000Z'
- '2026-10-10'
exit: 1
```

### THROW PROOF — C1 restore en-US date formatting (tests/scheduler-grid-mapping.test.ts)
```
$ git diff src/components/time-tracker/components/schedule/schedule-grid-model.ts
--- a/src/components/time-tracker/components/schedule/schedule-grid-model.ts
+++ b/src/components/time-tracker/components/schedule/schedule-grid-model.ts
@@ -53,7 +53,11 @@
 export function formatSchedulerDate(dateStr: string, locale?: string | null): string {
     if (!dateStr) return '—';
-    return formatWeekdayDayMonth(dateStr, locale);
+    return shiftMoment(dateStr, '12:00').toLocaleDateString('en-US', {
+        weekday: 'short',
+        month: 'short',
+        day: 'numeric',
+    });

$ node --import ./tests/register.mjs --test tests/scheduler-grid-mapping.test.ts; echo "exit: $?"
✖ GRID-SURFACE-1 C1: date formatters route through lib/format/date with no en-US order (0.5825ms)
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^vr/i. Input:
'Fri, Oct 9'
exit: 1
```

### 7 · Measurements
`None.`

### 8 · 🟨 Report-only items
- **A1 regex candidates:**
  - `src/lib/records/business-period.ts:11`: `/^\d{4}-\d{2}-\d{2}$/`
  - `src/lib/kernel/absence.ts:32`: `/^\d{4}-\d{2}-\d{2}$/`
  *(Both are candidate consumers of `isCalendarDay`).*
- **A3 toast status:** In `src/app/[locale]/admin/hr/employees/page.tsx:216`, failed API responses show `toast.error(t('saveFailed'))`.

### 9 · Not done, and why
- **C2 runtime test in `node --test tests/scheduler-grid-mapping.test.ts`:**
  - `src/lib/hr-api.ts:11`: `constructor(message: string, public readonly status: number, public readonly body: Record<string, any>)` triggers Node 24 strip-only syntax error (`SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode`).
  - When `schedule-grid-model.ts` imports `useScheduledShifts.ts` at runtime, Node 24 loads `hr-api.ts`.
  - `src/lib/hr-api.ts` is outside the directive's fence. Under §3b, editing a fenced file is prohibited.

### 10 · Noticed, out of scope
- `src/lib/hr-api.ts:11` constructor parameter properties cause Node v24 `--strip-types` to throw. Desugaring `public readonly status` to explicit assignments (`this.status = status`) in `src/lib/hr-api.ts` would resolve this globally.

### 11 · Uncertain
`None.`
