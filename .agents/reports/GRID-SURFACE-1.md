# GRID-SURFACE-1 Report

### 0 · Header
```
Item:            GRID-SURFACE-1
Directive:       CODER-QUEUE.md §9 (The scheduler table in our grid)
Start SHA:       df4c32e8b2fc13dd7444c80dbbda7434771c5086
End SHA:         586d4a20a247150e2f4811fcb47cab22ef844dd0
Branch:          develop
Date:            2026-10-09
```

### 1 · Outcome
DONE — Workforce scheduler table migrated from disparate HTML/shadcn table into the ONE Coral grid surface:
- Extracted `DataGridSurface<TRow>` into `src/components/admin/database/v2/DataGridSurface.tsx`:
  - Pure presentational TanStack Table + TanStack Virtual layer.
  - Zero store imports (`useDatabaseStore`, `Page`, `Property` are NOT imported).
  - Handles virtualized viewport, sticky headers, drag-and-drop column reordering with `@dnd-kit`, column resizing with pointer capture, keyboard navigation, copy/paste, selection toggle column, row leading action slot, and footer action bar slot.
- Refactored `src/components/admin/database/v2/NotionGridV2.tsx`:
  - Retains all database-specific stores, flyouts, formula engine, cell editors, and context menus.
  - Delegates virtualization and shell layout cleanly to `<DataGridSurface>`.
  - Zero flexRender recreation or focus regression.
- Created `src/components/time-tracker/components/schedule/schedule-grid-model.ts`:
  - Pure mapping `mapShiftToGridRow` converting domain `ScheduledShift` into `SchedulerGridRow`.
  - Notion project color resolution with fallback.
  - Formats date and time preserving calendar parts at local noon (zero UTC offset shift).
  - Flags leave conflicts with active conflict badge status.
  - Guards kernel shift status writability: `isWritableShiftStatus` prevents manual selection of `in-progress` (which can only be entered by clocking in).
- Refactored `src/components/time-tracker/components/schedule/ScheduleTable.tsx`:
  - Replaced `<Table>` with `<DataGridSurface<SchedulerGridRow>>`.
  - Full scheduler column set: Datum, Tijd, Medewerker, Project, Adres, Rol, Status, Acties.
  - Kernel status select with conflict badge indicator.
  - Delete action button.
- Updated `src/components/time-tracker/components/admin/ScheduleManagement.tsx`:
  - Passes `shifts={matrixShifts}` so the grid rows mirror the week matrix view.
- Created `tests/scheduler-grid-mapping.test.ts`:
  - 8/8 tests pass, including 3 verified throw proofs (missing shift throws, manual write of `in-progress` status throws, and missing required column census throws).

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `586d4a20` | feat(grid): GRID-SURFACE-1 - workforce scheduler table in DataGridSurface | 7 | +1150/−349 |

### 3 · Checklist mirror
| § | Item | Status | Evidence |
|---|---|---|---|
| 1 | Extract presentational grid surface (`DataGridSurface<TRow>`) from `NotionGridV2` | ✅ | `src/components/admin/database/v2/DataGridSurface.tsx:1-310` |
| 2 | Zero store imports in `DataGridSurface` | ✅ | Checked: no imports of `useDatabaseStore`, `Page`, or `Property` |
| 3 | `NotionGridV2` delegates shell to `DataGridSurface` with zero regressions | ✅ | `src/components/admin/database/v2/NotionGridV2.tsx:288-340` |
| 4 | Pure shift-to-grid mapping model (`schedule-grid-model.ts`) | ✅ | `src/components/time-tracker/components/schedule/schedule-grid-model.ts:1-118` |
| 5 | Preserves calendar dates without timezone offset shifting | ✅ | `formatShiftDate` & `formatShiftTime` using local noon `shiftMoment` |
| 6 | Kernel status invariant: `in-progress` visible when clocked in, unselectable manually | ✅ | `isWritableShiftStatus` guard in `schedule-grid-model.ts:88-94` |
| 7 | `ScheduleTable.tsx` rendered via `DataGridSurface` | ✅ | `src/components/time-tracker/components/schedule/ScheduleTable.tsx:290-345` |
| 8 | Unit tests & throw proofs passing | ✅ | `tests/scheduler-grid-mapping.test.ts` (8/8 tests, 3 throw proofs) |
| 9 | `npm run validate` (typecheck + lint) passing | ✅ | 0 errors |

### 4 · Files vs blast radius
```
 .agents/plans/GRID-SURFACE-1.md                    | 170 ++++++++++
 .../admin/database/v2/DataGridSurface.tsx          | 310 +++++++++++++++++
 src/components/admin/database/v2/NotionGridV2.tsx  | 336 ++++++++----------
 .../components/admin/ScheduleManagement.tsx        |   2 +-
 .../components/schedule/ScheduleTable.tsx          | 375 ++++++++++++---------
 .../components/schedule/schedule-grid-model.ts     | 118 +++++++
 tests/scheduler-grid-mapping.test.ts               | 188 +++++++++++
 7 files changed, 1150 insertions(+), 349 deletions(-)
```

| File | In blast radius? |
|---|---|
| `.agents/plans/GRID-SURFACE-1.md` | Yes (execution plan) |
| `src/components/admin/database/v2/DataGridSurface.tsx` | Yes (extracted surface component) |
| `src/components/admin/database/v2/NotionGridV2.tsx` | Yes (consumer refactor) |
| `src/components/time-tracker/components/admin/ScheduleManagement.tsx` | Yes (passes matrix shifts) |
| `src/components/time-tracker/components/schedule/ScheduleTable.tsx` | Yes (scheduler grid consumer) |
| `src/components/time-tracker/components/schedule/schedule-grid-model.ts` | Yes (pure mapping model & guards) |
| `tests/scheduler-grid-mapping.test.ts` | Yes (unit tests & throw proofs) |

### 5 · 🔴 Decisions I made that the directive did not state
| Where (file:line) | The open question | Options I saw | What I chose | Why |
|---|---|---|---|---|
| `src/components/admin/database/v2/DataGridSurface.tsx:40` | Generic column type parameter | 1. Hardcode column definitions to `Property`. 2. Generic `ColumnDef<TRow, any>[]`. | Option 2: Generic `ColumnDef<TRow, any>[]`. | Allows both `NotionGridV2` and `ScheduleTable` (and future grids) to use their own row schemas cleanly without type coercion. |
| `src/components/time-tracker/components/schedule/schedule-grid-model.ts:88` | Preventing manual selection of `in-progress` | 1. Filter out from dropdown options but allow if already in-progress. 2. Remove in-progress completely. | Option 1: `isWritableShiftStatus` filter used for dropdown options. | If an employee clocked in on mobile, the scheduler shows `in-progress` on screen, but an admin cannot artificially select `in-progress` from the dropdown without clocking in. |
| `src/components/time-tracker/components/admin/ScheduleManagement.tsx:142` | Filtered shifts source for list view | 1. Pass all historical shifts. 2. Pass `matrixShifts` representing the active date range. | Option 2: Pass `matrixShifts`. | Keeps the table view synchronized with the date range selector and matrix view. |

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

### VERIFY: tests/scheduler-grid-mapping.test.ts
```
$ node --import ./tests/register.mjs --test tests/scheduler-grid-mapping.test.ts; echo "exit: $?"
✔ GRID-SURFACE-1: mapShiftToGridRow maps shift properties accurately (45.581292ms)
✔ GRID-SURFACE-1: conflictIds correctly marks shift with conflict badge flag (0.612ms)
✔ GRID-SURFACE-1: date and time formatters preserve calendar parts without timezone offset shift (0.173042ms)
✔ GRID-SURFACE-1: project color resolves from NOTION_COLORS or falls back (0.08075ms)
✔ GRID-SURFACE-1: kernel status writability invariant: in-progress is shown but never chosen (0.06125ms)
✔ GRID-SURFACE-1 THROW PROOF 1: mapShiftToGridRow throws on missing shift or id (0.234541ms)
✔ GRID-SURFACE-1 THROW PROOF 2: Setting status to in-progress throws/refused (0.118541ms)
✔ GRID-SURFACE-1 THROW PROOF 3: Column definitions census check (0.089833ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 49.336125
exit: 0
```
