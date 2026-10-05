# CORAL — CODER REPORT — WH-7-M2

### 0 · Header
```
Item:            WH-7-M2
Directive:       .agents/workflows/coder-directive-wh-7.md
Directive blob:  d70e4d5a8f6efe524150a75a5075f89495f114e1
Start SHA:       b238bc3e9f42df467a139a04a50fe5c862bc38bb
End SHA:         dfbb97aa0563454ae79188ae630df32cf5e1b212
Branch:          develop
Date:            2026-10-05
```

---

### 1 · Outcome
`DONE — Rebuilt EditShiftDialog and subcomponents on the pure model under src/components/time-tracker/components/schedule/shift-editor/, featuring signed work order lock detection and banner (C4), C7 WerkbonCard placement and artifact filtering, elimination of useScheduleAttachments.ts via direct uploadFileAction + addShiftFile and hrList/hrDelete, series scope picker, and convert-to-recurring expansion.`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `dfbb97aa` | `feat(wh-7): M2 — shift edit dialog on pure model` | 5 | +1345/−26 |
| `pending` | `docs(report): WH-7-M2` | 1 | +170 |

---

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| M2.1 | `ShiftLockBanner.tsx` component | ✅ | `src/components/time-tracker/components/schedule/shift-editor/components/ShiftLockBanner.tsx:1-42` |
| M2.2 | `ShiftTasksTab.tsx` component with project task assignment, quick-creation, completion, and lock disabling | ✅ | `src/components/time-tracker/components/schedule/shift-editor/components/ShiftTasksTab.tsx:1-276` |
| M2.3 | `ShiftAttachmentsTab.tsx` component eliminating `useScheduleAttachments.ts` | ✅ | `src/components/time-tracker/components/schedule/shift-editor/components/ShiftAttachmentsTab.tsx:1-358` |
| M2.4 | C7: `<WerkbonCard shiftId={shift.id} />` rendered at top of Details tab | ✅ | `EditShiftDialog.tsx:372-373` |
| M2.5 | C7: `<WerkbonCard shiftId={shift.id} />` rendered at top of Attachments tab | ✅ | `ShiftAttachmentsTab.tsx:202-203` |
| M2.6 | C7: Ordinary attachments filter excludes signed PDF and legacy signature image | ✅ | `ShiftAttachmentsTab.tsx:195-196` (`!isWerkbonArtifact({ name: a.name }, isWerkbonFile)`) |
| M2.7 | C4: Work order lock state evaluation via `evaluateShiftLockState(auditLogs)` on open | ✅ | `EditShiftDialog.tsx:170-184` |
| M2.8 | C4: Visual locked state: form inputs disabled, delete hidden, save replaced by "Sluiten" | ✅ | `EditShiftDialog.tsx:342, 574-604` |
| M2.9 | Concurrency/fallback guard for 409 / `work_order_signed` error on update or delete | ✅ | `EditShiftDialog.tsx:256-270, 281-295` |
| M2.10 | Series scope picker integration (`ScopePicker` with `occurrence`, `following`, `series`) | ✅ | `EditShiftDialog.tsx:558-568` |
| M2.11 | Convert single shift to recurring series via `buildRecurringExpansionFromExisting` | ✅ | `EditShiftDialog.tsx:215-231, 513-555` |
| M2.12 | Derive `CreateShiftPayload` and `UpdateShiftPayload` from `ScheduledShift` | ✅ | `model.ts:52-85` |

---

### 4 · Files vs blast radius
Verbatim from `git diff --stat b238bc3e..dfbb97aa`:
```
 .../schedule/shift-editor/EditShiftDialog.tsx      | 641 +++++++++++++++++++++
 .../components/ShiftAttachmentsTab.tsx             | 358 ++++++++++++
 .../shift-editor/components/ShiftLockBanner.tsx    |  42 ++
 .../shift-editor/components/ShiftTasksTab.tsx      | 276 +++++++++
 .../components/schedule/shift-editor/model.ts      |  54 +-
 5 files changed, 1345 insertions(+), 26 deletions(-)
```

| File | In blast radius? |
|---|---|
| `src/components/time-tracker/components/schedule/shift-editor/model.ts` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/components/ShiftLockBanner.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/components/ShiftTasksTab.tsx` | ✅ Yes (§FENCE) |
| `src/components/time-tracker/components/schedule/shift-editor/components/ShiftAttachmentsTab.tsx` | ✅ Yes (§FENCE) |

Zero files outside `src/components/time-tracker/components/schedule/shift-editor/**` were modified. Old `EditShiftDialog.tsx` and `useScheduleAttachments.ts` remain untouched until M4 cutover.

---

### 5 · Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `ShiftTasksTab.tsx:16, ShiftAttachmentsTab.tsx:42` | How to update tab header badges with item counts | 1. Parent dialog fetches all tasks & attachments redundantly<br>2. Subcomponents report counts via `onCountChange` callback | Chosen: `onCountChange?: (count: number) => void` | Avoids duplicate data fetching while preserving real-time tab badge counters in the dialog header |
| `ShiftAttachmentsTab.tsx:117-152` | How to link project files to a shift | 1. Force uploadFileAction on project files<br>2. Use `hrCreate('shift-attachments', ...)` with existing project file URL | Chosen: `hrCreate('shift-attachments')` | Project files already exist in storage (`t_{tenantId}/project/...`); linking them via standard `shift-attachments` record avoids duplicate blob uploads |
| `EditShiftDialog.tsx:256-270` | Concurrency guard error handling | 1. Only check `err.status === 409`<br>2. Check both `err.status === 409` and `errMsg.includes('work_order_signed')` | Chosen: Check both | Catches server-side rejection whether thrown as an `HrApiError` with status code or as an Error with message |

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
(0 errors, 0 warnings in `src/components/time-tracker/components/schedule/shift-editor/**`.)

### VERIFY 3 — Full Repository Test Suite
```
$ node --import ./tests/register.mjs --test 'tests/*.test.ts'; echo "exit: $?"
ℹ tests 520
ℹ suites 56
ℹ pass 508
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 12
ℹ duration_ms 5372.578583
exit: 0
```

---

### 7 · Measurements
- Lines of code in new `EditShiftDialog.tsx`: 641 lines (vs 944 lines in legacy `EditShiftDialog.tsx`).
- Subcomponents created: 3 (`ShiftLockBanner.tsx`, `ShiftTasksTab.tsx`, `ShiftAttachmentsTab.tsx`).
- Eliminated dependencies: `useScheduleAttachments.ts` not used by new `shift-editor`.
- Type safety: Strict derivation from `ScheduledShift` with 0 `any` types.

---

### 8 · Report-only items
`None.`

---

### 9 · Not done, and why
- M3 (`shift-editor/CreateShiftForm.tsx`, `InlineCreateProjectModal.tsx`) and M4 (cutover in `ScheduleManagement.tsx`, deletion of legacy files): not done — protocol requires stopping for Planner review after M2.

---

### 10 · Noticed, out of scope
`None.`
