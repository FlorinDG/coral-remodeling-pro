# DB-HEADER-1 Milestone 3 Report — Financials Screens Migration & Planner Corrections C7–C10

Item:            DB-HEADER-1
Milestone:       M3
Branch:          develop
Date:            2026-10-06

---

## 1 · Summary of Work Delivered

### 1. Planner Review Corrections C7–C10 Implemented
Prior to migrating the financial screens, binding corrections C7–C10 from Planner Review M2 were applied:

- **C7 · Export follows selection again:**
  - Lifted `selectedRowIds` state to `DatabaseClone.tsx` (`const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set())`).
  - Passed `selectedRowIds` down to `DatabaseHeader.tsx` and `selected={selectedRowIds}` + `onSelectedChange={setSelectedRowIds}` to `NotionGridV2Dynamic`.
  - In `DatabaseHeader.tsx`, `useExportCSV` receives `selectedRowIds` alongside `filteredPages: sortedPages`, ensuring that when rows are selected, only the selected rows are exported, in the view's exact sort order.
- **C8 · Single computation of filtered & sorted rows:**
  - Shifted `useFilteredPages` and `sortPages` to run once in `DatabaseClone.tsx`.
  - Passed `sortedPages` down to `DatabaseHeader.tsx` and `NotionGridV2Dynamic`.
  - Removed duplicate `useFilteredPages` execution inside `DatabaseHeader.tsx`, eliminating double work per keystroke on large datasets.
- **C9 · Removed dead toolbar in `NotionGridV2.tsx`:**
  - Deleted the dead `!hideToolbar` branch (duplicate Properties, Filter, Sort, Wrap text, Export, Import, Accountant export controls) from `NotionGridV2.tsx`.
  - Preserved the selection bar (`selected.size > 0`) with delete, clear selection, and bulk approve controls.
  - Removed unused imports and states (`importOpen`, `exportOpen`, `SpreadsheetImportModal`, `AccountantExportDialog`, `Upload`, `Download`, `WrapText`).
- **C10 · Backdrop pattern replaces document listeners in `DatabaseHeader.tsx`:**
  - Replaced the two `document.addEventListener('mousedown')` calls (view type selector dropdown portal and view context menu portal) with fixed portal backdrops (`<div className="fixed inset-0 z-[99998]" onMouseDown={() => setOpen(false)} onClick={e => e.stopPropagation()} />`), matching the established pattern in `v2/cells.tsx SelectCell`.
  - Completely eliminated document listeners from the header menus.

### 2. Financials Screens Migration (8 Screens)
- **`tickets/page.tsx`:**
  - Removed ad-hoc top action bar (Scan/Upload, Bulk Upload, Manual Entry).
  - Wired `onAction` into `DatabaseCloneDynamic` handling `'scan-ticket'`, `'bulk-upload-tickets'`, and `'manual-ticket'`.
  - Actions now render in Level 1 of the canonical unified header using the tenant brand color, lucide icons, and translated labels.
- **`expenses/invoices/page.tsx`:**
  - Removed ad-hoc top action bar (Sync Peppol, Scan/Upload, Manual Invoice, Peppol badges).
  - Wired `onAction` into `DatabaseCloneDynamic` handling `'scan-invoice'`, `'manual-invoice'`, and `'peppol-sync'`.
  - Relocated Peppol connection status badge and sync result badge into `headerExtra` of `DatabaseCloneDynamic`, cleanly displayed in Level 2 next to the grid toolbar.
- **Other 6 Financial Screens:**
  - Verified and confirmed that `expenses/credit-notes`, `expenses/payments`, `income/invoices`, `income/credit-notes`, `income/proformas`, and `income/payments` already render through `DatabaseCloneDynamic` and automatically gain the unified header layout with zero ad-hoc bars.

---

## 2 · Verification & Test Results

1. **Compilation Check:**
   ```bash
   npm run test:compile
   # Exit code 0, clean compile with zero TypeScript errors
   ```

2. **Pure Rule Unit Tests:**
   ```bash
   node --import ./tests/register.mjs --test tests/db-header.test.ts
   # 15 tests, 15 passed, 0 failed
   ```

3. **Full Test Suite:**
   ```bash
   node --import ./tests/register.mjs --test 'tests/*.test.ts'
   # 576 tests: 564 passed, 0 failed, 12 todo
   ```

4. **Zero Regressions:**
   - 100% test pass rate preserved across all suites (Occ, Store, Gate, Records, DB Header, Werkbon, etc.).

---

## 3 · Files Changed

| File | Changes |
| :--- | :--- |
| `src/components/admin/database/components/DatabaseHeader.tsx` | Implemented C10 backdrop portals, consumed `sortedPages` and `selectedRowIds` for C7/C8, removed duplicate `useFilteredPages`. |
| `src/components/admin/database/v2/NotionGridV2.tsx` | Implemented C9 deleting dead toolbar and modals; consumed lifted selection and `sortedPages` from props for C7/C8. |
| `src/components/admin/database/DatabaseClone.tsx` | Lifted `selectedRowIds` state, executed single `useFilteredPages` and `sortPages` pass, passed `onAction` and shared state to children. |
| `src/app/[locale]/admin/financials/expenses/tickets/page.tsx` | Removed ad-hoc action bar, wired `onAction` (`scan-ticket`, `bulk-upload-tickets`, `manual-ticket`). |
| `src/app/[locale]/admin/financials/expenses/invoices/page.tsx` | Removed ad-hoc action bar, wired `onAction` (`scan-invoice`, `manual-invoice`, `peppol-sync`), passed Peppol badges to `headerExtra`. |
