# CORAL — CODER REPORT — WH-7-M1

### 0 · Header
```
Item:            WH-7-M1
Directive:       .agents/workflows/coder-directive-wh-7.md
Directive blob:  d70e4d5a8f6efe524150a75a5075f89495f114e1
Start SHA:       9fe6d8359f134db957ae6cfbe983c50937a079c6
End SHA:         65310156996bf42beea2189d2d883ce6ee5cf518
Branch:          develop
Date:            2026-10-05
```

---

### 1 · Outcome
`DONE — pure shift editor model implemented with DST-safe kernel calendar arithmetic, strictly camelCase ScheduledShift payloads, characterization tests, and verified throw proofs.`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `65310156` | `feat(schedule): WH-7 M1 pure shift editor model` | 2 | +784/-0 |
| `pending` | `docs(report): WH-7-M1` | 1 | +180 |

---

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| M1.1 | Pure model module (no React, no fetch, no I/O) | ✅ | `src/components/time-tracker/components/schedule/shift-editor/model.ts:1-416` |
| M1.2 | Form state validation (`validateShiftForm`) | ✅ | `model.ts:109-152`; tests `shift-editor-model.test.ts:17-133` |
| M1.3 | DST-safe recurrence expansion (`expandRecurringShiftDates`) using kernel string arithmetic alone (C3) | ✅ | `model.ts:154-184`; test `shift-editor-model.test.ts:151-174` |
| M1.4 | Range & leave date expansion (`expandRangeShiftDates`) with weekend exclusion | ✅ | `model.ts:186-210`; test `shift-editor-model.test.ts:176-193` |
| M1.5 | CamelCase payloads (`CreateShiftPayload`, `UpdateShiftPayload`) matching `ScheduledShift` (C2) | ✅ | `model.ts:46-83, 212-326`; test `shift-editor-model.test.ts:197-238` |
| M1.6 | Multi-worker same-day work order grain shares `seriesId` (WO-2, `CreateShiftForm.tsx:520`) | ✅ | `model.ts:269-272`; test `shift-editor-model.test.ts:253-269` |
| M1.7 | Solo worker single day has `seriesId: undefined` (`CreateShiftForm.tsx:520`) | ✅ | `model.ts:269-272`; test `shift-editor-model.test.ts:240-251` |
| M1.8 | Leave shift payload formatting (`CreateShiftForm.tsx:532-544`) | ✅ | `model.ts:276-290`; test `shift-editor-model.test.ts:271-295` |
| M1.9 | Recurring expansion from existing shift skips original date (`EditShiftDialog.tsx:337`) | ✅ | `model.ts:348-385`; test `shift-editor-model.test.ts:316-337` |
| M1.10 | Work order lock evaluation based strictly on audit row `action: 'sign'` (C4) | ✅ | `model.ts:387-415`; test `shift-editor-model.test.ts:339-371` |
| M1.11 | Throw proof: snake_case payload key detection (C2) | ✅ | Test `shift-editor-model.test.ts:221-226` throws on `user_id` |
| M1.12 | Throw proof: DST transition slip under `TZ=Europe/Brussels` (C3) | ✅ | Mutating `expandRecurringShiftDates` to `Date + toISOString` causes 3 test failures under `TZ=Europe/Brussels` (see §6) |

---

### 4 · Files vs blast radius
Paste verbatim from `git diff --stat 9fe6d835..65310156`:
```
 .../components/schedule/shift-editor/model.ts      | 416 +++++++++++++++++++++
 tests/shift-editor-model.test.ts                   | 368 ++++++++++++++++++
 2 files changed, 784 insertions(+)
```
| File | In blast radius? |
|---|---|
| `src/components/time-tracker/components/schedule/shift-editor/model.ts` | ✅ Yes (May create per §FENCE) |
| `tests/shift-editor-model.test.ts` | ✅ Yes (May create per §FENCE) |

---

### 5 · Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `model.ts:167-178` | How to sort and deduplicate expanded recurring dates | 1. Return raw order from nested loops<br>2. `Array.from(new Set(dates)).sort()` | Chosen: `Array.from(new Set(dates)).sort()` | Chronological order prevents unordered UI rendering if selectedDays array was unordered (e.g. `[5, 1]`) |
| `model.ts:269-272` | Fallback generator for `seriesId` in browser runtime | 1. `Math.random().toString(36).slice(2, 9)`<br>2. `crypto.randomUUID()` | Chosen: `crypto.randomUUID()` default with optional custom injector | Complies with C6 Planner answer while keeping the function purely testable with deterministic IDs in unit tests |
| `model.ts:285` | Leave shift note formatting when notes is empty vs populated | 1. Just reason<br>2. `Leave: ${reason}` or `Leave: ${reason} - ${notes}` | Chosen: `Leave: ${reason}${notes ? ' - ' + notes : ''}` | Exactly characterizes `CreateShiftForm.tsx:538` |

---

### 6 · Verification — commands, not descriptions

### VERIFY 1 — Unit tests with Node test runner under `TZ=Europe/Brussels`
```
$ TZ=Europe/Brussels node --import ./tests/register.mjs --test 'tests/shift-editor-model.test.ts'; echo "exit: $?"
✔ validateShiftForm: rejects missing workers (2.339167ms)
✔ validateShiftForm: rejects missing date (0.065083ms)
✔ validateShiftForm: rejects end date before start date (0.096083ms)
✔ validateShiftForm: rejects missing start or end time (0.0675ms)
✔ validateShiftForm: rejects recurring without selected days or valid weeks (0.070292ms)
✔ validateShiftForm: rejects leave without leaveReason (0.049125ms)
✔ validateShiftForm: passes on valid input (0.992375ms)
✔ expandRecurringShiftDates: characterizes CreateShiftForm.tsx:463-470 recurrence loop (0.208333ms)
✔ expandRecurringShiftDates: DST spring transition safe (Europe/Brussels) (0.094292ms)
✔ expandRangeShiftDates: characterizes CreateShiftForm.tsx:525-528 range with weekend exclusion (0.142042ms)
✔ buildCreateShiftPayloads: produces strictly camelCase keys — zero snake_case (C2) (0.208625ms)
✔ buildCreateShiftPayloads: solo worker on single day has seriesId undefined (CreateShiftForm.tsx:520) (0.076667ms)
✔ buildCreateShiftPayloads: multiple workers on single day share same seriesId (CreateShiftForm.tsx:520 WO-2) (0.063459ms)
✔ buildCreateShiftPayloads: characterizes leave shift formatting (CreateShiftForm.tsx:532-544) (0.067167ms)
✔ buildUpdateShiftPayload: produces strictly camelCase update payload (0.085542ms)
✔ buildRecurringExpansionFromExisting: skips existing shiftDate (EditShiftDialog.tsx:337) (0.114333ms)
✔ evaluateShiftLockState: locks ONLY when action sign row exists (C4) (0.088458ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 156.389083
exit: 0
```

### VERIFY 2 — THROW PROOF: DST transition slip under `TZ=Europe/Brussels` (C3)
When `expandRecurringShiftDates` is mutated to use local `Date` and `.toISOString().split('T')[0]`:
```ts
const [y, m, d] = startDate.split('-').map(Number);
const dt = new Date(y, m - 1, d);
dt.setDate(dt.getDate() + daysToAdd + week * 7);
const targetDate = dt.toISOString().split('T')[0];
```
Running `TZ=Europe/Brussels node --import ./tests/register.mjs --test 'tests/shift-editor-model.test.ts'` outputs:
```
✖ expandRecurringShiftDates: characterizes CreateShiftForm.tsx:463-470 recurrence loop (1.799792ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
  +   '2026-10-04',
  +   '2026-10-06',
  +   '2026-10-08',
  +   '2026-10-11',
  +   '2026-10-13',
  +   '2026-10-15'
  -   '2026-10-05',
  -   '2026-10-07',
  -   '2026-10-09',
  -   '2026-10-12',
  -   '2026-10-14',
  -   '2026-10-16'
    ]

✖ expandRecurringShiftDates: DST spring transition safe (Europe/Brussels) (0.202375ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
  +   '2026-03-22',
  +   '2026-03-28',
  -   '2026-03-23',
      '2026-03-29',
  +   '2026-04-04'
  -   '2026-03-30',
  -   '2026-04-05'
    ]
ℹ tests 17
ℹ suites 0
ℹ pass 14
ℹ fail 3
exit: 1
```

### VERIFY 3 — Full repository test suite
```
$ node --import ./tests/register.mjs --test 'tests/*.test.ts'; echo "exit: $?"
ℹ tests 516
ℹ suites 56
ℹ pass 504
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 12
ℹ duration_ms 4477.958417
exit: 0
```

### VERIFY 4 — TypeScript compile & ESLint
```
$ npm run test:compile && npm run test:lint
✖ 1430 problems (0 errors, 1430 warnings)
exit: 0
```

---

### 7 · Measurements
- Tests in `tests/shift-editor-model.test.ts`: 17 passing tests (0 failures).
- Lines of pure model: 416 lines in `src/components/time-tracker/components/schedule/shift-editor/model.ts`.
- Snake_case keys in payload output: 0.

---

### 8 · Report-only items
`None.`

---

### 9 · Not done, and why
- M2 (`shift-editor/EditShiftDialog.tsx`), M3 (`shift-editor/CreateShiftForm.tsx`), M4 (switch): Not done — protocol mandates stopping after M1 for Planner review.

---

### 10 · Noticed, out of scope
- `package.json` does not declare `"type": "module"`, triggering a Node typeless package warning on direct test invocation (warnings only, tests run cleanly).
