# CORAL — CODER REPORT — WH-7-M4

### 0 · Header
```
Item:            WH-7-M4
Directive:       .agents/plans/WH-7.md
Start SHA:       352463b2
End SHA:         afe1da0d
Branch:          develop
Date:            2026-10-05
```

---

### 1 · Outcome
`DONE — WH-7 completed: ScheduleManagement switched to shift-editor; legacy CreateShiftForm.tsx (2,035 lines), EditShiftDialog.tsx (943 lines), and useScheduleAttachments.ts (142 lines) deleted; SUPA-2 allowlist in eslint.config.mjs shrunk from 5 files to 2; M4 date-formatting correction applied across CreateShiftForm and EditShiftDialog using pure formatCalendarDay (zone-safe, non-midnight, Brussels-anchored); 18/18 tests pass in tests/shift-editor-model.test.ts; full 56-suite test run green (553 pass, 0 fail). Net reduction: 3,082 lines of dead code and debt eliminated.`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `afe1da0d` | `feat(wh-7): M4 — switch ScheduleManagement to shift-editor, delete legacy forms, shrink SUPA-2 allowlist` | 10 | +51/−3133 |

---

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| M4.1 | Update imports in `ScheduleManagement.tsx` to `@/components/time-tracker/components/schedule/shift-editor` | ✅ | `src/components/time-tracker/components/admin/ScheduleManagement.tsx:6` |
| M4.2 | Verify with git grep that no other file imports the old files | ✅ | Verified via grep; only `ScheduleManagement.tsx` imported them |
| M4.3 | Delete `src/components/time-tracker/components/schedule/CreateShiftForm.tsx` | ✅ | Deleted via `git rm` (2,035 lines removed) |
| M4.4 | Delete `src/components/time-tracker/components/schedule/EditShiftDialog.tsx` | ✅ | Deleted via `git rm` (943 lines removed) |
| M4.5 | Delete `src/components/time-tracker/hooks/useScheduleAttachments.ts` | ✅ | Deleted via `git rm` (142 lines removed) |
| M4.6 | In `eslint.config.mjs`: remove deleted files from SUPA-2 allowlist | ✅ | `eslint.config.mjs:233-236` (down to 2 files: `timesheets.ts` and `useScheduledShifts.ts`) |
| M4 Correction | Pure calendar day formatting from ymd (never format a midnight instant) | ✅ | Implemented `formatCalendarDay` in `model.ts`, tested in `tests/shift-editor-model.test.ts`, applied to `CreateShiftForm.tsx:741,769` and `EditShiftDialog.tsx:379` |
| Tests & Quality | 0 type errors (`npm run test:compile`), 0 lint warnings/errors (`npx eslint`), full suite green | ✅ | 565 tests across 56 test suites (553 pass, 0 fail, 12 todo) |

---

### 4 · Files vs blast radius
Verbatim from `git diff --stat 352463b2..afe1da0d`:
```
 eslint.config.mjs                                  |    7 +-
 .../components/admin/ScheduleManagement.tsx        |    3 +-
 .../components/schedule/CreateShiftForm.tsx        | 2035 --------------------
 .../components/schedule/EditShiftDialog.tsx        |  943 ---------
 .../schedule/shift-editor/CreateShiftForm.tsx      |    6 +-
 .../schedule/shift-editor/EditShiftDialog.tsx      |    4 +-
 .../components/schedule/shift-editor/index.ts      |    5 +
 .../components/schedule/shift-editor/model.ts      |   17 +
 .../time-tracker/hooks/useScheduleAttachments.ts   |  142 --
 tests/shift-editor-model.test.ts                   |   22 +
 10 files changed, 51 insertions(+), 3133 deletions(-)
```

| File | In blast radius? |
|---|---|
| `eslint.config.mjs` | ✅ Yes (§FENCE explicitly allows SUPA-2 allowlist shrinking at M4) |
| `src/components/time-tracker/components/admin/ScheduleManagement.tsx` | ✅ Yes (§FENCE explicitly allows import update at M4) |
| `src/components/time-tracker/components/schedule/CreateShiftForm.tsx` | ✅ Yes (§FENCE delete) |
| `src/components/time-tracker/components/schedule/EditShiftDialog.tsx` | ✅ Yes (§FENCE delete) |
| `src/components/time-tracker/hooks/useScheduleAttachments.ts` | ✅ Yes (§FENCE delete) |
| `src/components/time-tracker/components/schedule/shift-editor/**` | ✅ Yes (§FENCE creation/updates) |
| `tests/shift-editor-model.test.ts` | ✅ Yes (§FENCE unit test additions) |

Zero files outside the permitted blast radius were modified.

---

### 5 · Tests and proofs
- **Test command:** `node --import ./tests/register.mjs --test tests/shift-editor-model.test.ts`
- **Output:**
```
✔ validateShiftForm: rejects missing workers (1.276291ms)
✔ validateShiftForm: rejects missing date (0.111625ms)
✔ validateShiftForm: rejects end date before start date (0.112ms)
✔ validateShiftForm: rejects missing start or end time (0.083083ms)
✔ validateShiftForm: rejects recurring without selected days or valid weeks (0.072917ms)
✔ validateShiftForm: rejects leave without leaveReason (0.060875ms)
✔ validateShiftForm: passes on valid input (0.396584ms)
✔ expandRecurringShiftDates: characterizes CreateShiftForm.tsx:463-470 recurrence loop (0.609875ms)
✔ expandRecurringShiftDates: DST spring transition safe (Europe/Brussels) (0.114417ms)
✔ expandRangeShiftDates: characterizes CreateShiftForm.tsx:525-528 range with weekend exclusion (0.147292ms)
✔ buildCreateShiftPayloads: produces strictly camelCase keys — zero snake_case (C2) (0.235125ms)
✔ buildCreateShiftPayloads: solo worker on single day has seriesId undefined (CreateShiftForm.tsx:520) (0.102916ms)
✔ buildCreateShiftPayloads: multiple workers on single day share same seriesId (CreateShiftForm.tsx:520 WO-2) (0.164334ms)
✔ buildCreateShiftPayloads: characterizes leave shift formatting (CreateShiftForm.tsx:532-544) (0.070542ms)
✔ buildUpdateShiftPayload: produces strictly camelCase update payload (0.168458ms)
✔ buildRecurringExpansionFromExisting: skips existing shiftDate (EditShiftDialog.tsx:337) (0.11325ms)
✔ evaluateShiftLockState: locks ONLY when action sign row exists (C4) (0.091625ms)
✔ formatCalendarDay: formats date string safely across all zones (M4 correction) (68.378584ms)
ℹ tests 18
ℹ pass 18
ℹ fail 0
```
- **Full test suite:** `node --import ./tests/register.mjs --test 'tests/*.test.ts'`
  - 565 tests, 56 suites: **553 pass, 0 fail, 12 todo**.
- **Type compile:** `npm run test:compile` (0 errors).
- **ESLint:** `npx eslint` clean on all touched files.

---

### 6 · What Florin can inspect
- Open `/admin/workhub/schedule` (or Schedule Management).
- Create shifts: click "+ Schedule Shift" or click a matrix cell; confirm single, recurring, and leave shift creation works smoothly.
- Edit shifts: click any shift in the schedule table or matrix; confirm form opens with details, tasks, and attachments tabs.
- Locked shifts: view any shift whose work order was signed by a client; verify the amber lock banner is rendered, controls are disabled, delete is hidden, and WerkbonCard is displayed.
