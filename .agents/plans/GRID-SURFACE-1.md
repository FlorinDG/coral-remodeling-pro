# PLAN — GRID-SURFACE-1 · Scheduler Table in the ONE Grid

### 0 · Header
```
Item:            GRID-SURFACE-1
Directive:       .agents/workflows/CODER-QUEUE.md (§9 · GRID-SURFACE-1)
Feedback:        Florin 2026-10-08: "wrong table" → our grid
Workspace:       coral-remodeling-pro
Branch:          develop
Date:            2026-10-09
Status:          PLAN DRAFTED — Awaiting Review & GO
```

---

### 1 · Context & Objective

Today, the workforce scheduler table view in `src/components/time-tracker/components/schedule/ScheduleTable.tsx` is rendered using a standard shadcn/tailwind HTML table (`@/components/ui/table`) inside a card. It looks and behaves disconnected from the rest of the application's unified database grid (`NotionGridV2`).

**Objective:**
1. Extract a store-agnostic presentational grid surface (`DataGridSurface`) from `src/components/admin/database/v2/NotionGridV2.tsx`.
2. Keep `NotionGridV2`'s database-backed behavior completely unchanged by composing it over `DataGridSurface`.
3. Re-implement `ScheduleTable.tsx` using `DataGridSurface`, rendering shifts with canonical grid styling:
   - Columns: Datum · Tijd · Medewerker · Project · Adres · Rol · Status · [Acties]
   - Status: kernel status select as today (`isWritableShiftStatus` — `in-progress` shown when clocked in, but never selectable to write) + leave conflict badge.
   - Rows: the shifts for the weeks the matrix view displays (`matrixShifts`).
4. Throw-proof unit tests for the shift → row mapping and invariants.

---

### 2 · Architecture & File Boundaries

```
src/components/admin/database/v2/
├── DataGridSurface.tsx          [NEW] Pure presentational grid surface (TanStack Table + Virtual)
│                                - Header: draggable columns, resizable handles, selection toggle
│                                - Body: virtualized rows, keyboard navigation, copy/paste
│                                - Footer slot: "+ Nieuw" and bulk action bar
│                                - NO store imports (no useDatabaseStore, no Page, no Property)
└── NotionGridV2.tsx             [REFACTORED] Adapts DatabaseStore into DataGridSurface
                                 - Holds store hooks, cell editors, formula engine, VAT lookup
                                 - 100% backward-compatible for all database screens

src/components/time-tracker/components/
├── schedule/
│   ├── ScheduleTable.tsx        [REFACTORED] Renders shifts using DataGridSurface
│   └── schedule-grid-model.ts   [NEW] Pure shift -> row mapping & column definitions
└── admin/
    └── ScheduleManagement.tsx   [UPDATED] Passes matrixShifts to ScheduleTable (weeks the matrix shows)

tests/
└── scheduler-grid-mapping.test.ts [NEW] Characterization tests + 3 throw proofs
```

---

### 3 · Detailed Implementation Steps

#### Step 1: Create `DataGridSurface.tsx`
Extract the generic presentational shell from `NotionGridV2.tsx`:
- **Generic type parameters:** `DataGridSurface<TRow>`
- **Core Props:**
  - `data: TRow[]`
  - `columns: ColumnDef<TRow>[]`
  - `getRowId: (row: TRow) => string`
  - `totalWidth?: number`
  - `rowHeight?: number` (default 36px)
  - `wrapText?: boolean`
  - `selected?: Set<string>`
  - `onToggleRow?: (id: string) => void`
  - `onSelectAll?: (selectAll: boolean) => void`
  - `allSelected?: boolean`
  - `showSelectionColumn?: boolean`
  - `renderRowLeading?: (row: TRow, index: number) => React.ReactNode`
  - `activeCell?: { rowId: string; colId: string } | null`
  - `onActiveCellChange?: (active: { rowId: string; colId: string } | null) => void`
  - `onCopy?: (e: React.ClipboardEvent) => void`
  - `onPaste?: (e: React.ClipboardEvent) => void`
  - `onColumnMove?: (sourceColId: string, targetColId: string) => void`
  - `onColumnResize?: (colId: string, width: number) => void`
  - `renderTabs?: React.ReactNode`
  - `renderFooter?: React.ReactNode`
  - `emptyMessage?: React.ReactNode`
- **Features preserved:**
  - TanStack Table (`useReactTable`, `getCoreRowModel`)
  - TanStack Virtual (`useVirtualizer`)
  - Column drag & drop reorder indicators
  - Pointer capture column resize handles
  - Keyboard navigation (arrows, Enter, F2, Tab, Escape)
  - Scroll container focus retention

#### Step 2: Refactor `NotionGridV2.tsx` to use `DataGridSurface`
- Keep `useDatabaseStore`, `useFilteredPages`, `useOpenLinkedRecord`, etc.
- Keep cell edit state (`editing`, `startEdit`, `commit`, `commitValue`).
- Retain all special cells (`SelectCell`, `CheckboxCell`, `DateCell`, `RelationCell`, `RollupCell`, `FormulaCell`, `VatLookupFlyout`, `RowMenu`).
- Delegate the virtualized table DOM rendering, column dragging, resizing, keyboard navigation, copy/paste, and footer to `<DataGridSurface>`.
- Run verification: test existing database screens to guarantee zero regression.

#### Step 3: Pure Mapping Module `schedule-grid-model.ts`
Create `src/components/time-tracker/components/schedule/schedule-grid-model.ts`:
- Defines `SchedulerGridRow`:
  ```ts
  export interface SchedulerGridRow {
      id: string;
      shiftDate: string;        // 'YYYY-MM-DD'
      formattedDate: string;    // 'Thu, Oct 9' (locale-aware)
      timeRange: string;        // '08:00 - 17:00'
      workerName: string;       // employee name or 'Unknown'
      userId: string;
      project: {
          id: string;
          name: string;
          color?: string;
          address?: string;
      } | null;
      address: string;
      role: string;
      formattedRole: string;
      status: string;           // kernel shiftStatus
      isConflict: boolean;      // leave conflict
      rawShift: ScheduledShift;
  }
  ```
- Function `mapShiftToGridRow(shift, locale, tShifts, conflictIds)`
- Function `getSchedulerColumns(...)`

#### Step 4: Refactor `ScheduleTable.tsx`
- Replace `<Card>` and shadcn `<Table>` with `<DataGridSurface<SchedulerGridRow>>`.
- Include the columns:
  1. **Datum** (`colDate`): formatted date with day of week.
  2. **Tijd** (`colTime`): start - end time.
  3. **Medewerker** (`colEmployee`): worker name.
  4. **Project** (`colProject`): project badge with Notion color.
  5. **Adres** (`colLocation`): execution/project address.
  6. **Rol** (`colRole`): translated role label.
  7. **Status** (`colStatus`): kernel status selector (`isWritableShiftStatus` ensures `in-progress` is displayed when running, but disabled in write dropdown), plus conflict badge.
  8. **Acties** (`colActions`): delete icon button if `canManage`.
- Row click: triggers `onShiftClick(row.rawShift)`.
- Row height: 36px (matching NotionGridV2).
- Filter bar (All / Upcoming / Past) integrated above the grid or in header tabs slot.

#### Step 5: Update `ScheduleManagement.tsx`
- Pass `matrixShifts` (representing the weeks the matrix view shows) instead of all historical/future shifts to `ScheduleTable`.

#### Step 6: Tests & Throw Proofs (`tests/scheduler-grid-mapping.test.ts`)
- Test 1: `mapShiftToGridRow` accurately extracts date, time range, project color, role, and kernel status.
- Test 2: `isConflict` flag is true when shift id is in `conflictIds`.
- Test 3: Status options enforce `isWritableShiftStatus` (`in-progress` cannot be chosen manually).
- **THROW PROOF 1:** Shift with missing ID or invalid time format throws/is rejected.
- **THROW PROOF 2:** Attempt to set status to `in-progress` manually throws / is rejected.
- **THROW PROOF 3:** Column definitions census check throws if any required column (Datum, Tijd, Medewerker, Project, Adres, Rol, Status) is omitted.

---

### 4 · Blast Radius Checklist
- [ ] `src/components/admin/database/v2/DataGridSurface.tsx` (new)
- [ ] `src/components/admin/database/v2/NotionGridV2.tsx` (refactor to use surface)
- [ ] `src/components/time-tracker/components/schedule/schedule-grid-model.ts` (new)
- [ ] `src/components/time-tracker/components/schedule/ScheduleTable.tsx` (refactor to use surface)
- [ ] `src/components/time-tracker/components/admin/ScheduleManagement.tsx` (pass matrixShifts)
- [ ] `tests/scheduler-grid-mapping.test.ts` (new test)
- [ ] `.agents/reports/GRID-SURFACE-1.md` (report)

---

### 5 · Verification Criteria
- `npm run test:compile` exits 0.
- `npm run test:lint` exits 0.
- `node --import ./tests/register.mjs --test tests/scheduler-grid-mapping.test.ts` exits 0 with all throw proofs passing.
- Visual inspection: Scheduler table has the exact look, feel, column resizing, and row heights of the Notion grid.
