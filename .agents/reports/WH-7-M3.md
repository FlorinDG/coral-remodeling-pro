# CORAL — CODER REPORT — WH-7-M3

### 0 · Header
```
Item:            WH-7-M3
Directive:       .agents/workflows/coder-directive-wh-7.md
Directive blob:  d70e4d5a8f6efe524150a75a5075f89495f114e1
Start SHA:       fc6d1b0fa581ba828ee5f8e56dc7a77e5c6a1e35
End SHA:         7437382e887d4a2fa42194ffacb37cf5a9ca223a
Branch:          develop
Date:            2026-10-05
```

---

### 1 · Outcome
`DONE — Rebuilt CreateShiftForm and InlineCreateProjectModal on the pure model under src/components/time-tracker/components/schedule/shift-editor/, eliminating 650 lines of duplicate JSX between controlled and uncontrolled modes, supporting single, recurring, and leave shifts with DST-safe kernel calendar arithmetic, template loading/saving/deletion, inline project creation, and task/attachment queueing. Applied M2 corrections using kernel shiftMoment, localDateKey, and zonedParts across EditShiftDialog and ShiftLockBanner.`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `7437382e` | `feat(wh-7): M3 — shift create form on pure model` | 4 | +1368/−18 |
| `88b6de48` | `docs(report): WH-7-M3` | 1 | +126 |

---

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| M3.1 | M2 Correction 1: Date picker uses kernel `shiftMoment(ymd, '00:00')` and `localDateKey(date)` | ✅ | `EditShiftDialog.tsx:100-106` |
| M3.2 | M2 Correction 2: `ShiftLockBanner` formats `signedAt` on business clock with kernel `zonedParts(isoTs)` | ✅ | `ShiftLockBanner.tsx:9-13, 20` |
| M3.3 | `InlineCreateProjectModal.tsx` modal helper for inline project creation with name, address, GPS location, Notion colors | ✅ | `shift-editor/components/InlineCreateProjectModal.tsx:1-177` |
| M3.4 | Unified `CreateShiftForm.tsx` supporting controlled and uncontrolled modes without JSX duplication | ✅ | `shift-editor/CreateShiftForm.tsx:1-1188` |
| M3.5 | Single, Recurring, and Leave schedule types driven by pure `model.ts:buildCreateShiftPayloads` | ✅ | `CreateShiftForm.tsx:441-477` |
| M3.6 | Multi-worker single-day shifts share a single `seriesId` (WO-2 visit) | ✅ | Verified by `model.ts` integration; test `tests/shift-editor-model.test.ts:253` |
| M3.7 | Leave shift schedule: 08:00–17:00, status `'leave'`, `shiftName` from leave reason, weekend exclusion | ✅ | `CreateShiftForm.tsx:441-477` |
| M3.8 | Template management: list (`hrList`), apply, save (`hrCreate`), delete (`hrDeleteEntity`) | ✅ | `CreateShiftForm.tsx:210-220, 276-302` |
| M3.9 | Task linking: assign existing project tasks or quick-create tasks post shift creation | ✅ | `CreateShiftForm.tsx:304-338, 373-385` |
| M3.10 | Attachments queue: upload files (`uploadFileAction` + `addShiftFile`) and project files (`listRecordFiles` + `hrCreate`) | ✅ | `CreateShiftForm.tsx:340-370, 387-418` |

---

### 4 · Files vs blast radius
Verbatim from `git diff --stat fc6d1b0f..7437382e`:
```
 .../schedule/shift-editor/CreateShiftForm.tsx      | 1188 ++++++++++++++++++++
 .../schedule/shift-editor/EditShiftDialog.tsx      |   10 +-
 .../components/InlineCreateProjectModal.tsx        |  177 +++
 .../shift-editor/components/ShiftLockBanner.tsx    |   11 +-
 4 files changed, 1368 insertions(+), 18 deletions(-)
```

| File | In blast radius? |
|---|---|
| `src/components/time-tracker/components/schedule/shift-editor/CreateShiftForm.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/components/InlineCreateProjectModal.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/components/ShiftLockBanner.tsx` | ✅ Yes (§FENCE) |

Zero files outside `src/components/time-tracker/components/schedule/shift-editor/**` were modified. Old `CreateShiftForm.tsx` remains untouched until M4.

---

### 5 · Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `CreateShiftForm.tsx:1150-1188` | How to eliminate duplicate JSX between controlled and uncontrolled modes | 1. Repeat dialog content twice as in old file<br>2. Store dialog content in a variable / component render function | Chosen: Shared `dialogContent` element | Eliminates 650 lines of duplicate JSX while supporting both `<DialogTrigger>` and controlled `open={open}` |
| `InlineCreateProjectModal.tsx:55-65` | How to update parent when project is created | 1. Rely on parent refetching projects<br>2. Callback `onProjectCreated(id)` to immediately select the new project | Chosen: `onProjectCreated(id)` callback | Gives immediate user feedback by auto-selecting the newly created project in the shift form |

---

### 6 · Verification — commands, not descriptions

### VERIFY 1 — TypeScript Compile Check
```
$ npm run test:compile; echo "exit: $?"
> coral-remodeling-pro@0.1.0 test:compile
> NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit

exit: 0
```

### VERIFY 2 — ESLint Check on New Shift Editor Code
```
$ npx eslint src/components/time-tracker/components/schedule/shift-editor; echo "exit: $?"
exit: 0
```
(0 errors, 0 warnings across all files in `shift-editor/**`.)

### VERIFY 3 — Full Repository Test Suite
```
$ node --import ./tests/register.mjs --test 'tests/*.test.ts'; echo "exit: $?"
ℹ tests 535
ℹ suites 56
ℹ pass 523
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 12
ℹ duration_ms 4450.562
exit: 0
```

---

### 7 · Measurements
- Lines of code in new `CreateShiftForm.tsx`: 1,188 lines (vs 2,036 lines in legacy `CreateShiftForm.tsx`).
- Duplicate JSX eliminated: ~650 lines.
- ESLint errors/warnings: 0.

---

### 8 · Report-only items
`None.`

---

### 9 · Not done, and why
- M4 (switch in `ScheduleManagement.tsx`, deletion of legacy files, eslint allowlist cleanup): not done — protocol requires stopping for review.

---

### 10 · Noticed, out of scope
`None.`
