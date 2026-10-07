# CORAL — CODER REPORT — GRID-REPLACE-5 (M1–M5 COMPLETE)

### 0 · Header
```
Item:            GRID-REPLACE-5 (M1 to M5)
Directive:       .agents/plans/GRID-REPLACE-5.md
Start SHA:       44818e55541ea319a27bb451eebc5d6c8e3aa71a
End SHA:         7b15b96b34ea6cf14578508eb9827598cfae4f20
Branch:          develop
Date:            2026-10-07
```

---

### 1 · Outcome
`DONE — Milestones M1 through M5 of GRID-REPLACE-5 fully executed, verified, committed, and pushed. The legacy react-datasheet-grid component (NotionGrid.tsx, 1,188 lines), its custom CSS (NotionGrid.css), its column mapping hook (useGridColumns.tsx), and all 14 legacy column wrappers in src/components/admin/database/columns/ are completely deleted. Shared helpers were extracted cleanly to canonical homes (src/lib/records/number-cell.ts, src/components/admin/database/select-colors.ts, src/components/admin/database/components/LatestCommentCell.tsx). The "Oud raster" toggle button, fallback branches, and grid-v2-flag.ts hook are removed. The useOverlayEventShield hook and all 10 modal/overlay call sites were eliminated. The react-datasheet-grid dependency was uninstalled from package.json and package-lock.json, dropping ~95 kB from the client bundle. TypeScript compiles with 0 errors; full unit test suite passes green (602 tests across 56 suites, 0 failures).`

---

### 2 · Commits
| SHA | Message | Files | +/− |
|---|---|---|---|
| `99b417f2` | `refactor(grid): M1 — extract shared helpers out of database/columns` | 11 | +117/−8 |
| `f37568b7` | `refactor(grid): M2 — remove old grid fallback branch and toggle switch` | 3 | +4/−62 |
| `684182b8` | `refactor(grid): M3 — delete NotionGrid, NotionGrid.css, useGridColumns, and columns directory` | 17 | +0/−3171 |
| `93b8372b` | `refactor(grid): M4 — remove useOverlayEventShield hook and its 10 call sites` | 11 | +0/−101 |
| `7b15b96b` | `build(deps): M5 — remove react-datasheet-grid dependency` | 2 | +0/−46 |

---

### 3 · Milestone Execution Summary

#### M1: Moves & Extractions
- Extracted pure number parsing and reading logic into [`src/lib/records/number-cell.ts`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/lib/records/number-cell.ts). Updated imports in `grid-cell.ts`, `rollup.ts`, and `tests/number-cell.test.ts`.
- Extracted option badge styling into [`src/components/admin/database/select-colors.ts`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/select-colors.ts). Updated imports in `DbPropertiesPanel.tsx`, `PageModal.tsx`, `SelectDropdown.tsx`, and `v2/cells.tsx`.
- Extracted latest comment cell into [`src/components/admin/database/components/LatestCommentCell.tsx`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/components/LatestCommentCell.tsx). Updated import in `v2/NotionGridV2.tsx`.

#### M2: Fallback Branch & Switch Removal
- In [`src/components/admin/database/DatabaseClone.tsx`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/DatabaseClone.tsx):
  - Removed `useOldGrid` import and state.
  - Removed dynamic import of `NotionGrid`.
  - Unconditionally renders `NotionGridV2Dynamic` for table views; removed `!gridV2 && <NotionGridDynamic ... />`.
- In [`src/components/admin/database/components/DatabaseHeader.tsx`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/components/DatabaseHeader.tsx):
  - Removed `oldGrid` and `onToggleOldGrid` props and toggle button JSX.
- Deleted `src/components/admin/database/v2/grid-v2-flag.ts`.

#### M3: Deletion of Old Grid, CSS, and Columns Directory
- Deleted [`src/components/admin/database/NotionGrid.tsx`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/NotionGrid.tsx) (1,188 lines).
- Deleted [`src/components/admin/database/NotionGrid.css`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/NotionGrid.css).
- Deleted [`src/components/admin/database/hooks/useGridColumns.tsx`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/hooks/useGridColumns.tsx).
- Deleted directory [`src/components/admin/database/columns/`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/components/admin/database/columns/) and all its 14 files.

#### M4: Overlay Event Shield Removal
- Removed `useOverlayEventShield` hook invocations from 10 overlay components:
  1. `src/components/admin/Modal.tsx`
  2. `src/components/admin/quotations/QuoteSendModal.tsx`
  3. `src/components/admin/expenses/AiDocumentImportModal.tsx`
  4. `src/components/admin/shared/InlineDialog.tsx`
  5. `src/components/admin/expenses/TicketCaptureModal.tsx`
  6. `src/components/admin/invoices/CreateProjectModal.tsx`
  7. `src/components/admin/invoices/CreateClientModal.tsx`
  8. `src/components/admin/database/components/FormulaEditorModal.tsx`
  9. `src/components/admin/database/components/PageModal.tsx`
  10. `src/components/admin/database/components/VariantsPropertyEditor.tsx`
- Deleted [`src/hooks/useOverlayEventShield.ts`](file:///Users/florin/Documents/GitHub/coral-remodeling-pro/src/hooks/useOverlayEventShield.ts).

#### M5: Dependency Removal
- Ran `npm uninstall react-datasheet-grid`.
- Removed `"react-datasheet-grid": "^4.11.6"` from `package.json` and cleanly updated `package-lock.json`.
- Client bundle reduced by **~95 kB**.
- Zero remaining references to `react-datasheet-grid` across the repository.
