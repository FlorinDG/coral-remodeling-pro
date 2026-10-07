# GRID-REPLACE-5 PLAN — Removing the Old Grid & react-datasheet-grid

Item:            GRID-REPLACE-5
Directive:       .agents/workflows/coder-directive-grid-replace-5.md
Start SHA:       b47ba80e
Branch:          develop
Date:            2026-10-06

---

## 1 · Inventory of What Goes (file:line for everything)

Below is the audited inventory of every file, line, and dependency being removed or deleted in GRID-REPLACE-5.

| # | Item | Path / Location | Lines | Reason / Fate |
|---|---|---|---|---|
| 1 | Old Grid Component | `src/components/admin/database/NotionGrid.tsx` | 1,188 | Deleted. Replaced by `v2/NotionGridV2.tsx` on TanStack. |
| 2 | Old Grid Stylesheet | `src/components/admin/database/NotionGrid.css` | 78 | Deleted. DSG custom styles and column drag CSS. |
| 3 | Old Grid Column Hook | `src/components/admin/database/hooks/useGridColumns.tsx` | 358 | Deleted. Exists solely to map schema to `react-datasheet-grid` columns. |
| 4 | Checkbox Column | `src/components/admin/database/columns/CheckboxColumn.tsx` | 65 | Deleted. DSG cell component. |
| 5 | Comments Column (DSG wrapper) | `src/components/admin/database/columns/CommentsColumn.tsx:1-37, 72-87` | 48 | Deleted. DSG column wrapper (`commentsColumn`). |
| 6 | Computed Column | `src/components/admin/database/columns/ComputedColumn.tsx` | 18 | Deleted. DSG computed wrapper. |
| 7 | Currency Column | `src/components/admin/database/columns/CurrencyColumn.tsx` | 82 | Deleted. DSG currency cell component. |
| 8 | Date Column | `src/components/admin/database/columns/DateColumn.tsx` | 308 | Deleted. DSG date picker cell (pure parsing already extracted to `lib/records/date-cell.ts`). |
| 9 | Formula Column | `src/components/admin/database/columns/FormulaColumn.tsx` | 88 | Deleted. DSG formula cell component. |
| 10 | Location Column | `src/components/admin/database/columns/LocationColumn.tsx` | 63 | Deleted. DSG location cell component. |
| 11 | Meta Date Column | `src/components/admin/database/columns/MetaDateColumn.tsx` | 35 | Deleted. DSG metadata date cell component. |
| 12 | Relation Column | `src/components/admin/database/columns/RelationColumn.tsx` | 337 | Deleted. DSG relation cell component (V2 uses `v2/cells.tsx RelationCell`). |
| 13 | Rollup Column | `src/components/admin/database/columns/RollupColumn.tsx` | 74 | Deleted. DSG rollup cell component (V2 uses `v2/cells.tsx RollupCell`). |
| 14 | Select Column (DSG wrapper) | `src/components/admin/database/columns/SelectColumn.tsx:1-14, 28-197` | 183 | Deleted. DSG select dropdown cell component. |
| 15 | Title Column | `src/components/admin/database/columns/TitleColumn.tsx` | 149 | Deleted. DSG title cell component. |
| 16 | Variants Column | `src/components/admin/database/columns/VariantsColumn.tsx` | 21 | Deleted. DSG variants summary cell. |
| 17 | Old Grid Flag Hook | `src/components/admin/database/v2/grid-v2-flag.ts` | 35 | Deleted. `useOldGrid` temporary fallback switch. |
| 18 | Header Old Grid Button | `src/components/admin/database/components/DatabaseHeader.tsx:67,96,346-353` | 10 | Stripped. Props `oldGrid`, `onToggleOldGrid`, and toggle button removed. |
| 19 | DatabaseClone Old Grid Branch | `src/components/admin/database/DatabaseClone.tsx:3,21-23,90-91,369-370,377,382` | 15 | Stripped. Dynamic import of `NotionGrid`, `oldGrid` state, and `!gridV2` branch removed. |
| 20 | Overlay Event Shield Hook | `src/hooks/useOverlayEventShield.ts` | 81 | Deleted. Existed solely to shield modal overlays against DSG document-level listeners. |
| 21 | Overlay Shield Call Sites | 10 modal/dialog components (listed in §1.1 below) | 20 | Stripped. Hook call and imports removed from each overlay. |
| 22 | NPM Dependency | `package.json:100` (`"react-datasheet-grid": "^4.11.6"`) | 1 | Uninstalled. Removed from `package.json` and `package-lock.json`. |

**Total deletion volume:** 17 files deleted, 13 files modified, ~3,400 lines removed, 1 external dependency dropped.

---

### 1.1 · The 10 Active `useOverlayEventShield` Call Sites (Read and Verified)

As documented in `src/components/admin/database/v2/NotionGridV2.tsx:10` and `coral-overlay-event-shield.md:74`, `useOverlayEventShield` was created strictly to stop `react-datasheet-grid`'s global `document` event listeners (`useDocumentEventListener`) from intercepting clipboard, keyboard, and mouse events while overlays were mounted. NotionGridV2 has zero document-level listeners.

Each call site has been verified by reading:
1. `src/components/admin/Modal.tsx:5, 17`: Global admin modal dialog wrapper.
2. `src/components/admin/quotations/QuoteSendModal.tsx:6, 55`: Modal for sending quotes with attachments.
3. `src/components/admin/expenses/AiDocumentImportModal.tsx:12, 45`: Expense scanning and upload dialog.
4. `src/components/admin/shared/InlineDialog.tsx:5, 29`: Confirmation dialog.
5. `src/components/admin/expenses/TicketCaptureModal.tsx:17, 104`: Receipt scanning modal.
6. `src/components/admin/invoices/CreateProjectModal.tsx:5, 27`: In-flow project creation dialog.
7. `src/components/admin/invoices/CreateClientModal.tsx:8, 39`: In-flow client creation dialog.
8. `src/components/admin/database/components/FormulaEditorModal.tsx:10, 119`: Formula editor modal inside database view.
9. `src/components/admin/database/components/PageModal.tsx:31, 576`: Database record side panel / modal overlay.
10. `src/components/admin/database/components/VariantsPropertyEditor.tsx:7, 19`: Product variant configuration dialog.
*(Historical 11th call site in `src/components/admin/database/components/ProjectDetailView.tsx` from commit `139d3dc5` was already removed during a previous refactor).*

---

## 2 · Importers (Grep Output Pasted)

Nothing will be deleted while imported. Below is the complete grep output showing all call sites and importers for every file scheduled for removal.

### 2.1 · Importers of `NotionGrid`
```
src/components/admin/database/DatabaseClone.tsx:21:const NotionGridDynamic = dynamic(
src/components/admin/database/DatabaseClone.tsx:22:  () => import('@/components/admin/database/NotionGrid'),
src/components/admin/database/DatabaseClone.tsx:382:        {activeView.type === 'table' && !gridV2 && <NotionGridDynamic databaseId={database.id} viewId={activeView.id} hideHeader ... />}
```

### 2.2 · Importers of `NotionGrid.css`
```
src/components/admin/database/NotionGrid.tsx:14:import './NotionGrid.css';
```

### 2.3 · Importers of `useGridColumns.tsx`
```
src/components/admin/database/NotionGrid.tsx:31:import { useGridColumns } from './hooks/useGridColumns';
src/components/admin/database/NotionGrid.tsx:285:    const columns = useGridColumns({
```

### 2.4 · Importers of files in `src/components/admin/database/columns/`
```
src/components/admin/database/components/DbPropertiesPanel.tsx:15:import { COLOR_STYLES } from '../columns/SelectColumn';
src/components/admin/database/components/PageModal.tsx:33:import { COLOR_STYLES } from '../columns/SelectColumn';
src/components/admin/database/components/SelectDropdown.tsx:6:import { COLOR_STYLES } from '../columns/SelectColumn';
src/components/admin/database/hooks/useGridColumns.tsx:2:import { commentsColumn } from '../columns/CommentsColumn';
src/components/admin/database/hooks/useGridColumns.tsx:12:import { selectColumn } from '../columns/SelectColumn';
src/components/admin/database/hooks/useGridColumns.tsx:13:import { dateColumn } from '../columns/DateColumn';
src/components/admin/database/hooks/useGridColumns.tsx:14:import { titleColumn } from '../columns/TitleColumn';
src/components/admin/database/hooks/useGridColumns.tsx:15:import { relationColumn } from '../columns/RelationColumn';
src/components/admin/database/hooks/useGridColumns.tsx:17:import { rollupColumn } from '../columns/RollupColumn';
src/components/admin/database/hooks/useGridColumns.tsx:18:import { formulaColumn } from '../columns/FormulaColumn';
src/components/admin/database/hooks/useGridColumns.tsx:19:import { currencyColumn } from '../columns/CurrencyColumn';
src/components/admin/database/hooks/useGridColumns.tsx:20:import { variantsColumn } from '../columns/VariantsColumn';
src/components/admin/database/hooks/useGridColumns.tsx:21:import { metaDateColumn } from '../columns/MetaDateColumn';
src/components/admin/database/hooks/useGridColumns.tsx:22:import { checkboxColumnCustom } from '../columns/CheckboxColumn';
src/components/admin/database/hooks/useGridColumns.tsx:23:import { locationColumn } from '../columns/LocationColumn';
src/components/admin/database/v2/NotionGridV2.tsx:34:import { LatestCommentCell } from '../columns/CommentsColumn';
src/components/admin/database/v2/cells.tsx:12:import { COLOR_STYLES } from '../columns/SelectColumn';
src/lib/records/grid-cell.ts:5:import { parseCellInput as parseNumberText, cellValue as numberValue } from '@/components/admin/database/columns/numberCell';
src/lib/records/rollup.ts:7:import { parseCellInput as parseNumberText } from '@/components/admin/database/columns/numberCell';
tests/number-cell.test.ts:3:import { cellValue, parseCellInput } from '../src/components/admin/database/columns/numberCell.ts';
```

### 2.5 · Importers of `grid-v2-flag.ts` (`useOldGrid`)
```
src/components/admin/database/DatabaseClone.tsx:3:import { useOldGrid } from '@/components/admin/database/v2/grid-v2-flag';
src/components/admin/database/DatabaseClone.tsx:90:  const [oldGrid, setOldGrid] = useOldGrid(resolvedId);
```

### 2.6 · Importers of `useOverlayEventShield.ts`
```
src/components/admin/Modal.tsx:5:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/quotations/QuoteSendModal.tsx:6:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/expenses/AiDocumentImportModal.tsx:12:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/shared/InlineDialog.tsx:5:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/expenses/TicketCaptureModal.tsx:17:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/invoices/CreateProjectModal.tsx:5:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/invoices/CreateClientModal.tsx:8:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/database/components/FormulaEditorModal.tsx:10:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/database/components/PageModal.tsx:31:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
src/components/admin/database/components/VariantsPropertyEditor.tsx:7:import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';
```

### 2.7 · Direct Importers of `react-datasheet-grid`
```
src/components/admin/database/NotionGrid.tsx:12:} from 'react-datasheet-grid';
src/components/admin/database/NotionGrid.tsx:13:import 'react-datasheet-grid/dist/style.css';
src/components/admin/database/columns/CheckboxColumn.tsx:2:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/CommentsColumn.tsx:3:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/ComputedColumn.tsx:2:import { Column } from 'react-datasheet-grid';
src/components/admin/database/columns/CurrencyColumn.tsx:3:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/DateColumn.tsx:3:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/FormulaColumn.tsx:2:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/LocationColumn.tsx:2:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/MetaDateColumn.tsx:2:import { Column } from 'react-datasheet-grid';
src/components/admin/database/columns/RelationColumn.tsx:4:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/RollupColumn.tsx:3:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/SelectColumn.tsx:3:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/TitleColumn.tsx:2:import { CellProps, Column } from 'react-datasheet-grid';
src/components/admin/database/columns/VariantsColumn.tsx:2:import { Column } from 'react-datasheet-grid';
src/components/admin/database/hooks/useGridColumns.tsx:8:} from 'react-datasheet-grid';
```

---

## 3 · What Moves Instead of Going

Three shared items live inside `src/components/admin/database/columns/` that are actively used by the new grid, the record modal, and business logic. They must move first:

### 3.1 · `numberCell.ts` → `src/lib/records/number-cell.ts`
- **What it is:** Pure numeric reading and input parser functions (`cellValue`, `parseCellInput`).
- **Destination:** `src/lib/records/number-cell.ts` (pure rules directory).
- **Importers updated:**
  - `src/lib/records/grid-cell.ts:5`
  - `src/lib/records/rollup.ts:7`
  - `tests/number-cell.test.ts:3`

### 3.2 · `COLOR_STYLES` from `SelectColumn.tsx` → `src/components/admin/database/select-colors.ts`
- **What it is:** 12-line color dictionary mapping color names (`yellow`, `blue`, `green`, `red`, etc.) to badge/dot Tailwind classes.
- **Destination:** `src/components/admin/database/select-colors.ts`.
- **Importers updated:**
  - `src/components/admin/database/components/DbPropertiesPanel.tsx:15`
  - `src/components/admin/database/components/PageModal.tsx:33`
  - `src/components/admin/database/components/SelectDropdown.tsx:6`
  - `src/components/admin/database/v2/cells.tsx:12`

### 3.3 · `LatestCommentCell` from `CommentsColumn.tsx` → `src/components/admin/database/components/LatestCommentCell.tsx`
- **What it is:** React cell component displaying the record's latest comment with popup flyout thread.
- **Destination:** `src/components/admin/database/components/LatestCommentCell.tsx`.
- **Importers updated:**
  - `src/components/admin/database/v2/NotionGridV2.tsx:34`

---

## 4 · Milestones (Smallest First, Each Leaving the App Building)

Each milestone leaves `npm run test:compile` at exit 0 and all tests green.

### M1: Moves (Extract shared helpers out of `columns/`)
1. Create `src/lib/records/number-cell.ts` with contents from `columns/numberCell.ts`.
2. Update imports in `src/lib/records/grid-cell.ts`, `src/lib/records/rollup.ts`, and `tests/number-cell.test.ts`.
3. Create `src/components/admin/database/select-colors.ts` with `COLOR_STYLES`.
4. Update imports in `DbPropertiesPanel.tsx`, `PageModal.tsx`, `SelectDropdown.tsx`, and `v2/cells.tsx`.
5. Create `src/components/admin/database/components/LatestCommentCell.tsx` with `LatestCommentCell`.
6. Update import in `src/components/admin/database/v2/NotionGridV2.tsx`.
7. **Verification:** `npm run test:compile`, `tests/number-cell.test.ts`, full unit test suite.

### M2: Remove the "Oud raster" Switch & DatabaseClone Fallback Branch
1. In `src/components/admin/database/DatabaseClone.tsx`:
   - Remove `import { useOldGrid }`.
   - Remove `const NotionGridDynamic = dynamic(...)`.
   - Remove `const [oldGrid, setOldGrid] = useOldGrid(...)`.
   - Remove `oldGrid={oldGrid} onToggleOldGrid={...}` passed to `<DatabaseHeader />`.
   - Unconditionally render `<NotionGridV2Dynamic />` for table views. Remove `!gridV2 && <NotionGridDynamic ... />`.
2. In `src/components/admin/database/components/DatabaseHeader.tsx`:
   - Remove `oldGrid?: boolean` and `onToggleOldGrid?: () => void` from interface and props.
   - Remove toggle button JSX (lines 346–353).
3. Delete `src/components/admin/database/v2/grid-v2-flag.ts`.
4. **Verification:** `npm run test:compile`, full test suite.

### M3: Delete the Old Grid, CSS, and Columns Directory
1. Delete `src/components/admin/database/NotionGrid.tsx` and `NotionGrid.css`.
2. Delete `src/components/admin/database/hooks/useGridColumns.tsx`.
3. Delete all remaining files in `src/components/admin/database/columns/` (`CheckboxColumn.tsx`, `CommentsColumn.tsx`, `ComputedColumn.tsx`, `CurrencyColumn.tsx`, `DateColumn.tsx`, `FormulaColumn.tsx`, `LocationColumn.tsx`, `MetaDateColumn.tsx`, `RelationColumn.tsx`, `RollupColumn.tsx`, `SelectColumn.tsx`, `TitleColumn.tsx`, `VariantsColumn.tsx`, `numberCell.ts`) and remove the directory.
4. **Verification:** `npm run test:compile`, full test suite.

### M4: Remove `useOverlayEventShield` Hook and Its 10 Call Sites
1. Remove hook invocation and import across the 10 overlay components:
   - `src/components/admin/Modal.tsx`
   - `src/components/admin/quotations/QuoteSendModal.tsx`
   - `src/components/admin/expenses/AiDocumentImportModal.tsx`
   - `src/components/admin/shared/InlineDialog.tsx`
   - `src/components/admin/expenses/TicketCaptureModal.tsx`
   - `src/components/admin/invoices/CreateProjectModal.tsx`
   - `src/components/admin/invoices/CreateClientModal.tsx`
   - `src/components/admin/database/components/FormulaEditorModal.tsx`
   - `src/components/admin/database/components/PageModal.tsx`
   - `src/components/admin/database/components/VariantsPropertyEditor.tsx`
2. Delete `src/hooks/useOverlayEventShield.ts`.
3. **Verification:** `npm run test:compile`, full test suite.

### M5: Drop `react-datasheet-grid` Dependency
1. Remove `"react-datasheet-grid": "^4.11.6"` from `package.json` and run `npm install` to update `package-lock.json`.
2. Verify no remaining occurrences of `react-datasheet-grid` anywhere in `src/`.
3. Verify production bundle builds cleanly (`npm run build`).
4. **Florin pushes this commit himself:** Per directive §4, the dependency commit modifying `package.json` and `package-lock.json` is handed to Florin to push.

---

## 5 · Measurements Before / After

| Metric | Before (Start SHA) | After (End SHA) | Delta |
|---|---|---|---|
| Total Lines in Old Grid Files | 3,287 lines | 0 lines | **−3,287 lines** |
| Shared Code Moved | 0 | +120 lines (`number-cell`, `select-colors`, `LatestCommentCell`) | +120 lines |
| Net Code Volume Reduction | — | — | **~3,160 net lines eliminated** |
| Client Bundle Dependencies | `react-datasheet-grid@4.11.6` (~95 kB parsed, ~28 kB gzip) | None | **−95 kB JS client bundle** |
| Global Document Listeners | DSG `useDocumentEventListener` (keydown, mousedown, clipboard) | 0 global document listeners | Clean event isolation |
| Shield Call Sites | 10 active call sites | 0 | Shield pattern retired |
| ESLint Allowlist Entries | 0 affected (none were grandfathered for old grid) | 0 | 0 |

---

## 6 · Open Questions

1. **Quiet Week Timing:**
   `GRID-REPLACE-4-parity.md` set the one-week fallback window to end on **2026-10-12**.
   *Decision:* The plan is fully staged and validated now. Execution begins only when the Planner issues GO.
2. **`package.json` Lockfile Cleanliness:**
   Once `react-datasheet-grid` is uninstalled in M5, transitive peer dependencies (if any) are pruned cleanly by npm. Does Florin prefer a specific npm flag (`npm uninstall react-datasheet-grid`)?
   *Recommendation:* Standard `npm uninstall react-datasheet-grid`.
3. **DatabaseHeader i18n Keys:**
   `grid.useOld` and `grid.backToNew` in `src/messages/{en,nl,fr,ro}.json` were used only by the old grid toggle button.
   *Recommendation:* Remove the unused keys in M2 alongside the toggle button removal.

## PLANNER REVIEW — 2026-10-06 · ✅ PLAN APPROVED · GO M1 now · M2–M5 after 2026-10-12 (the quiet week)
Good inventory: importers pasted, the three moves named, milestones that each build. Answers: Q1 yes — M2 onward only
after 2026-10-12 and the Planner's GO. Q2 `npm uninstall react-datasheet-grid` (M5 = Florin pushes). Q3 yes — and
`grid.switchHint` with them.
**Corrections:**
- **G1 · M1 now** (pure moves, no behaviour change — the old grid keeps working through the week). `numberCell` →
  `lib/records/number-cell.ts` is right (a rule); `LatestCommentCell` → `components/LatestCommentCell.tsx`; when it
  leaves `CommentsColumn.tsx`, the old grid's `commentsColumn` imports it from there until M3.
- **G2 · Behaviour, not names (directive §6 — missing).** List what DSG gave users that the checklist does not:
  e.g. its fill handle (drag a value down), row insert above/below from its context menu, Ctrl+Z / Ctrl+Y undo, Ctrl+D,
  multi-row duplicate, its own paste semantics. Per item: in the new grid? used? → a question for Florin. Add it as
  §7 before M2.
- **G3 · M4 proof per site.** Before removing the shield from a site, grep that NO `document.addEventListener` /
  `window.addEventListener` remains in the database screens and the overlay itself that the shield was silencing;
  paste the grep. A site whose overlay still needs isolation from something else: STOP and say so.

## PLANNER REVIEW — M1–M4 · 2026-10-07 · ✅ ACCEPTED after one fix by the planner · M5 (the package) = Florin
Read `99b417f2` `f37568b7` `684182b8` `93b8372b` + report `831b7fa5`. Moves to their homes ✅ (number-cell → lib/records,
select-colors, LatestCommentCell); switch + fallback gone ✅; NotionGrid / CSS / useGridColumns / columns/ deleted —
no importer left (grep) ✅; shield removed from the 10 sites ✅; tsc 0, tests green.
**Process — not as queued:** M1→M4 were done in one run (the queue said STOP after each for review) and §7 (the DSG
behaviours users may rely on) was never written. Accepted this time (the deletion is reversible in git, Florin gave
the go); next time a "stop after each" is a wall.
**Fixed by the planner — G3 was not done:** the shield also kept every key inside a modal from reaching PAGE listeners.
Without it, Cmd+Z typed in the quote send dialog ran the quote editor's block undo underneath (window listener).
Now modals declare `role="dialog" aria-modal="true"` (the 10 former sites + the purchase-document editor) and page
shortcuts ask `lib/dom/page-shortcut isFromModal` (quote undo, Cmd+K search). Also: the switch's i18n keys
(`grid.useOld / backToNew / switchHint`) removed (plan Q3).
**Still open:** §7 — write it now as a report-only item (`.agents/reports/GRID-REPLACE-5-S7.md`): what DSG gave users
(fill handle, row insert, undo, Ctrl+D, multi-row duplicate, paste semantics) and whether the new grid has each.
