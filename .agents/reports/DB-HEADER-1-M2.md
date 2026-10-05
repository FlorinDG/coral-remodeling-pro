# DB-HEADER-1 Milestone 2 Report — Unified Header Component

Item:            DB-HEADER-1
Milestone:       M2
Branch:          develop
Date:            2026-10-05

---

## 1 · Summary of Work Delivered

### 1. Planner Review Corrections R1–R6 Landed First
Prior to building the component, the binding review corrections from Planner Review M1 were applied to `src/lib/records/db-header.ts` and `tests/db-header.test.ts`:
- **R1 · Single source of truth for access:** Replaced `isAccountant` and `isBestekReadOnly` with `access: GridAccess` from `src/lib/records/grid-access.ts`. Reused `EXPENSES_INBOX_VIEW` for the inbox view check. Deleted legacy `surfaceKey === 'inbox'` check.
- **R2 · Canonical grid import/delete gates:** Import gate uses `access.create && !ctx.isLockedSchema`. Delete gate uses `access.delete`. Dropped custom `FINANCIAL_DOCUMENT_ROLES` lists.
- **R3 · Grid V2 toggle not modeled in rule:** Removed `showGridV2Toggle` from pure rule per GRID-REPLACE-4. The toggle is handled cleanly at the component level.
- **R4 · Translation keys exist and resolve:** Reused established action keys under `Admin.nav.pages` (`scanUploadTicket`, `bulkUploadTickets`, `manualTicket`, `scanUpload`, `manualInvoice`, `syncPeppolInbox`). Added missing keys (`editCustomFields`, `editSchemaFields`, `draftOnlyDelete`, `wrapText`) under `Admin.dbHeader` across all 4 locales (`nl.json`, `en.json`, `fr.json`, `ro.json`). Added throw proof asserting that every key returned by `computeDatabaseHeader` resolves to a non-empty string in `nl.json`.
- **R5 · Strict schema link handling:** If `!ctx.databaseId`, `schemaLink` is `null` (no fake fallback route).
- **R6 · Context cleanup & wrap text:** Pruned unused context fields (`planType`, `activeModules`, `hasDatabasesPermission`, `gridV2Enabled`). Added `showWrapText: !ctx.activeViewType || ctx.activeViewType === 'table'`.

### 2. Unified Header Component (`DatabaseHeader.tsx`)
Created `src/components/admin/database/components/DatabaseHeader.tsx` implementing the unified visual structure from Section 3 of the plan:
- **Two-level visual layout when declared actions or screen tabs exist:**
  - **Level 1 (Brand/Context & Declared Actions):** Screen tabs (or Icon + Title + Row count badge) on left; Action buttons (styled with tenant brand color for primary, lucide icons) + Schema Link Pill on right.
  - **Level 2 (View Tabs & Grid Navigation):** View tabs (Table, Board, Calendar, Timeline, `+ Add View` with type selector) on left; Grid toolbar (Properties, Filter, Sort, Wrap text, Export, Accountant export, Import, Old grid toggle) on right.
- **Collapsed single compact bar when no declared actions and no screen tabs:** Collapses into a single row preserving maximum vertical space for the grid (e.g. on `/admin/contacts`).
- **Interactive view management:** Tab switching, inline double-click renaming, view context menu (Rename, Change Type, Delete) via fixed Portals.
- **Integrated toolbars & modals:** Seamlessly renders `PropertiesDropdown`, `FilterToolbar`, `SortToolbar`, `AccountantExportDialog`, and `SpreadsheetImportModal`.

### 3. Integrated into `DatabaseClone.tsx` Behind Clean Boundary
- Replaced over 200 lines of inline `headerTabs` code in `src/components/admin/database/DatabaseClone.tsx` with `<DatabaseHeader />`.
- Provided `hideToolbar` to `NotionGridV2` and `hideHeader` to `NotionGrid`, `KanbanView`, `CalendarView`, and `TimelineView` to eliminate duplicate toolbar/header rendering.
- Net codebase reduction: -145 lines across modified files with zero functional regressions.

---

## 2 · Verification & Test Results

1. **Compilation:**
   ```bash
   npm run test:compile
   # Exit code 0, clean compile across entire project
   ```

2. **Unit Tests & Throw Proofs:**
   ```bash
   node --import ./tests/register.mjs --test tests/db-header.test.ts
   # 15 tests, 15 passed, 0 failed
   # - Accountant export permission leak throw proof: PASS
   # - Translation key existence throw proof (nl.json): PASS
   # - R1–R6 characterization tests: PASS
   ```

3. **Full Test Suite:**
   ```bash
   node --import ./tests/register.mjs --test 'tests/*.test.ts'
   # 567 tests: 555 passed, 0 failed, 12 todo (unrelated pending tests)
   ```

4. **ESLint:**
   ```bash
   npx eslint ... (modified files)
   # 0 errors
   ```

---

## 3 · Files Changed

| File | Change |
|---|---|
| `src/lib/records/db-header.ts` | Landed R1–R6: access reuse, import/delete gates, wrapText, schemaLink |
| `tests/db-header.test.ts` | Updated tests for R1–R6, added R4 throw proofs for nl.json |
| `src/messages/{en,nl,fr,ro}.json` | Added `Admin.dbHeader` translations (editCustomFields, editSchemaFields, draftOnlyDelete, wrapText) |
| `src/components/admin/database/components/DatabaseHeader.tsx` | New unified header component |
| `src/components/admin/database/DatabaseClone.tsx` | Replaced ad-hoc headerTabs with `<DatabaseHeader />` |
| `src/components/admin/database/v2/NotionGridV2.tsx` | Added `hideToolbar` support |
| `src/components/admin/database/NotionGrid.tsx` | Added `hideHeader` support |
| `src/components/admin/database/views/KanbanView.tsx` | Added `hideHeader` support |
| `src/components/admin/database/views/CalendarView.tsx` | Added `hideHeader` support |
| `src/components/admin/database/views/TimelineView.tsx` | Added `hideHeader` support |

---

## 4 · Ready for Review

M2 is complete and verified. Ready for Planner review before proceeding to M3 (Migrate Financials Screens).
