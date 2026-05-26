### This is where we will keep track of issues.


1. [FIXED] Connected Properties card: backlinking should be bi-directional (implemented cross-database bidirectional backlink discovery).
2. [FIXED] Expenses > approval: Add "Reject" button alongside approve.
3. [FIXED] Expenses > approval: In "Reject" mode, the field for adding a comment should be enabled.
4. [BUILT] Three levels of settings: Superadmin environment (all settings), ERP configuration (schema/modules, user-locked), and Workspace Settings (business preferences).
5. [BUILT] Mobile-friendly bottom navigation: Bottom nav bar for mobile main modules (Home/Tasks/Projects/Calendar/Settings).
6. [BUILT] HR Module: Rich, comprehensive Employee Profiles with contact details, employment history, compensation rates, emergency contacts, skills/certs, and quick stats.
7. [BUILT] Standalone Mobile Work Hub: Custom Homepage optimised for workforce mobile access.
8. [BUILT] Independent /workhub PWA Webapp: Fully decoupled workforce frontend shell with custom service worker, offline support, invite workflow, and role-based routing.


### Session 2026-05-22 — Codebase Combing Results

9. [FIXED] DnD cross-parent crash: Root `Droppable` in `ClientQuotationEngine.tsx` was using `type="block"` — same as child `Droppable` zones in `QuotationRow.tsx`. This caused `@hello-pangea/dnd` to get confused during cross-parent drag operations. Fix: root now uses `type="root"`, children keep `type="block"`.

10. [FIXED] RecordDetailPage cards crash propagation: A single crashing card (Stats, Connected Properties, Journal, or Files) would take down the entire record detail view. Fix: each card now wrapped in its own `ErrorBoundary`.

11. [FIXED] TypeScript error in `ClientQuotationEngine.tsx:420`: `handleUpdateProperty` parameter typed as `unknown` instead of `PropertyValue`.

12. [BUILT] Project Management detail view: When opening a record from `db-1` (Projects), a specialized PM layout now renders with: task board with status filters, timeline progress, budget tracking, schedule overview, and tabbed journal/files.

13. [FIXED] FileManager in RecordDetailPage: Was using `contextType="global"` without passing `driveFolderId`, causing empty Files cards. Fix: `RecordDetailPage` now maps `contextType` per database (project/client/task/quotation/invoice), passes `driveFolderId={boundDriveId}`, and auto-creates Drive folders on first load when missing.

14. [FIXED] CRM Main Pipeline page crash: Previously crashed due to missing error boundaries. After error boundary wrapping (issue #10) and schema enforcement fixes, the CRM page now loads cleanly. Verified via runtime Chrome DevTools debugging session — zero console errors on `/admin/crm`. Main Pipeline and Bobex Pipeline tabs both render correctly with records visible.

15. [FIXED] Journal breadcrumb: The standalone Journal module page at `/admin/journal` already renders its own header. The sidebar nav `href` correctly points to `/admin/journal`. No breadcrumb collision with BlockEditor.

16. [FIXED] Bobex Pipeline record pages: `RecordDetailPage` now maps `db-bobex` → "Bobex Pipeline" and `db-crm` → "Main Pipeline" via `displayName` variable, replacing the generic `database.name` in the breadcrumb.

17. [FIXED] Database Schema Editor crash (Superadmin > Settings > Databases > edit): The title property (index 0) was wrapped in a `Draggable` with `index={index-1}` = `-1`, which crashes `@hello-pangea/dnd`. Fix: title row is now rendered as a static `<tr>` outside the Draggable system.

18. [FIXED] Quotation PDF Import 20% margin: `confirmImport()` was hardcoding `defaultMarge = 20` and inflating `verkoopPrice` by 20% on every import. Removed — imported prices now match the source document exactly (`margePercent: 0`, `verkoopPrice = netto`). Added VAT % and Line Total columns to the results table.

19. [FIXED] Invoice PDF Import — unified with quotation import: Switched from old `/api/extract-pdf` (gpt-4o-mini, basic prompt) to unified `/api/integrations/parse-pdf` (gpt-4o, rich prompt with metadata). Added doc type selector, document metadata extraction, full column set (qty, unit, unit price, VAT %, line total). Metadata auto-fills invoice page properties (invoice #, date, totals, client match).

20. [FIXED] Deleted old `/api/extract-pdf/route.ts` endpoint — superseded by `/api/integrations/parse-pdf`.

21. [BUILT] HR module - documents: Setup partitioned database support and automated Google Drive subfolder scaffolding for IDs, photos, contracts, and required files.
22. [BUILT] Standalone Business Documents module: Centralized documents system supporting contracts, disputes, insurance, and certs, connectable from any module with automatic Drive folder generation.
23. [BUILT] Advancement state document (Vorderingstaat) in project management: Added "Create Vorderingstaat" in the quotation bottom row allowing progress-based item generation. Integrates a dedicated "Vorderingenstaten" project detail tab with cumulative tracking and draft-to-invoice conversion.
24. [BUILT] Provide alternative verification method for admin accounts. The only way to reset an admin password is via the `reset-password` script, which requires physical server access or direct database manipulation. 
25. [BUILT] Add user self-service password reset for admin accounts. 

26. [TODO] Add project-specific billing rules (fixed fee, progress-based, hourly) and a mechanism to enforce them in the quotation engine.
27. [FIXED] Project cost rates now derived from linked quotation: removed manual rate inputs (equipment rate, labour rate, equipment hours), replaced with quotation-sourced profitability card showing quote total, material cost, estimated labour, actual clocked costs, and margin analysis. Budget auto-derived from quotation when not set manually.
28. [TODO] Address "Not all variables are functions" TypeScript errors by either converting loose variables to computed getters or properly typing/scoping them within the component.
29. [TODO] Ensure all "Create Project From Template" functionality creates correct folder structures and populates the project with template tasks in a draft state, ready for refinement.
30. [FIXED] Mobile bottom-nav active state: The "More" tab in `MobileBottomNav.tsx` only highlighted for a few specific routes (settings, crm, db-clients, etc.), leaving routes like `/admin/contacts`, `/admin/financials`, `/admin/journal`, `/admin/library`, `/admin/quotations` with no active tab. Fix: "More" is now a catch-all that activates for any `/admin` route not claimed by the other 4 tabs (Home, Tasks, Projects, Calendar).
31. [BUILT] Use less white space in dashboard to make better use of space.
32. [FIXED] Resolved all critical `react-hooks/set-state-in-effect` errors in app pages and components (LinkedRecords, ClientInvoiceEngine, ClientQuotationEngine, JournalEntryClient, PO/Bordereau templates, HR time-tracker pages) and verified that typechecking compiles 100% cleanly.
33. [PARTIAL — SCOPED] Custom selects: Rolled out `SearchableSelect` replacement in Team Settings (access level), Company Info (interface language, document language, connector, date format, number width), UI Settings (module selector), Calendar (calendar selector, portal selector, task priority), and Email Sidebar (account switcher). Total: 14 native selects replaced across 5 high-traffic pages. Remaining ~20 files intentionally left: financial engines (tight data bindings, high regression risk), filter/sort toolbars (compact space, z-index conflicts), database schema editor (low traffic), and utility modals (LeadForm, TicketCapture, SpreadsheetImport). These can be revisited in a future batch with dedicated testing.
34. [FIXED] Task board editable titles + action bar: Added `EditableTitle` component to `TaskBoardView.tsx`. Users can now click a task card title to edit inline — Enter/blur saves, Escape cancels. Added action bar under title with: (1) **status select** with status icon + chevron — change status directly from card without drag-and-drop, (2) priority pill that cycles P1→P2→P3→P4 on click, (3) due date control with calendar icon and hidden date picker, (4) block/attachment count indicator. All wired via `TaskModuleShell` callbacks.
35. [FIXED] Journal card duplicate render: `JournalCard.tsx` was rendering `page.blocks` data twice — once as a summary entries list at the top, and again via a full `BlockEditor` embed below. Fix: removed the `BlockEditor` entirely from the card. The card now shows only the chronological entries list + quick-add form. Full editing stays in the standalone journal page (`/admin/journal/[id]`). Also added an empty-state with a CTA when no entries exist.
36. [FIXED] Article library formula NaN: The formula chain had two bugs: (1) Percent values (e.g. Discount=20 meaning 20%) were multiplied directly instead of being divided by 100, producing `BruttoKost * 20` instead of `BruttoKost * (1 - 20/100)`. Same for Marge Standard. Fix: corrected `NettoKost` formula to `BruttoKost * (1 - Discount / 100)` and `Marge€` to `NettoKost * (Marge Standard / 100)`. (2) Added NaN guard in both the formula engine (returns 0 instead of NaN to prevent cascading) and `FormulaColumn.tsx` (displays "—" instead of "NaN").
37. [FIXED] Dev server hang: `npm run dev` would hang indefinitely with zero output. Root cause: `package.json` dev script used `--webpack` flag (added in commit `b29d839` for pdfjs-dist compatibility). Next.js 16 + Node 24 causes webpack dev mode to hang silently. Fix: removed `--webpack` from dev script — Turbopack (Next 16 default) starts in seconds. Also removed deprecated `eslint` config block from `next.config.ts` (no longer supported in Next 16, caused startup warning).
38. [FIXED] `sid.slice is not a function` in DbPropertiesPanel: Relation property values could contain non-string items (numbers, objects). The code at line 314 called `sid.slice(0, 8)` without checking type. Fix: cast relation array items via `(value as any[]).map(v => String(v ?? ''))` and added `String(sid || '')` safety before `.slice()` call.
39. [FIXED] React hooks ordering in RecordDetailPage: `useFileManagerStore` and `useEffect` were called after two early returns (FREE gate + not-found guard), violating React's rules of hooks. Fix: moved all hooks above the early returns, used `page?.` optional chaining and `if (!page) return` guard inside useEffect.
40. [FIXED] Drive fetch console noise: `Failed to fetch` on `/api/drive` is expected when Google Drive OAuth isn't configured. Downgraded from `console.error` to silent catch (Rule 5 soft failure). Error state still set for UI display.
41. [FIXED] Button-in-button hydration error in SearchableSelect: The clear "X" was a `<button>` nested inside the trigger `<button>`, which is invalid HTML. Fix: changed to `<span role="button">` with keyboard support.
42. [FIXED] Infinite render loop in DatabaseConfigurator: `useDatabaseStore` selector at line 63 created a new `Set()` on every render — Zustand's `Object.is` equality sees each new Set as "changed", triggering re-render → infinite loop. Fix: replaced with `React.useMemo` keyed on `database` reference.
43. [FIXED] Journal entries not editable: `JournalCard` (used in RecordDetailPage and ProjectDetailView) showed entries as read-only `<p>` tags. Clicking a title in the journal feed navigated to the parent record, not an editor. Fix: made JournalCard entries editable inline — click text to edit in a textarea, ⌘+Enter/blur to save, Escape to cancel. Added hover delete button (trash icon) per entry. Clearing content on save also deletes the block. Removed `line-clamp-2` so full entry text is visible.
44. [FIXED] Journal rich blocks + cross-database linking: Two enhancements — (1) JournalCard now supports all Notion-style block types: heading 1/2/3, bulleted list, numbered list, todo (with checkbox toggle), quote, callout, code, divider. Block type selector available in both quick-add form and inline edit mode. (2) Journal entries created from Journal module now live in `db-journal-general` with optional cross-references via `linkedDatabaseId`/`linkedRecordId`/`linkedRecordTitle` properties. "New Entry" modal has universal database/record picker (Projects, Clients, CRM, Tasks, Quotations, Invoices, Suppliers, Bobex). Feed cards show clickable "Linked to: [title]" chip. JournalCard also displays linked entries from journal DB alongside the record's own blocks.
---

### Review — All Open Items Through the Lens of /pd (2026-05-24)

#### Corrections to the Previous Analysis

**The "Module Registry Violation" was a false alarm.** The previous analysis treated Journal as a new gated module that should be registered in `MODULE_GATE`, `MODULE_MAP`, `MODULE_ROUTE_MAP`, and the `MODULES` array. This is wrong. Here's why:

Journal is a **cross-cutting utility view**, not a billable subscription module. It aggregates block content from Projects, Clients, and CRM — it doesn't own exclusive functionality. The correct architectural precedent is `dashboard` and `contacts`: both appear in the sidebar but are **intentionally absent** from all 4 gating locations because they are available to all tiers.

The code confirms this is working as designed:
- `AdminLayout.tsx:165-166` — `isModuleLocked()` checks `MODULE_MAP[moduleId]`. If the item isn't in `MODULE_MAP`, it returns `false` (unlocked). Journal isn't in `MODULE_MAP`, so it's always visible. Same as Dashboard.
- `middleware.ts:239-244` — `MODULE_GATE` only blocks routes that map to a subscription module. `journal` has no entry, so the route passes through. Same as `dashboard` and `contacts`.
- `ROLE_ROUTE_ALLOWLISTS` (middleware:250-256) and `ROLE_SIDEBAR_ALLOW` (AdminLayout:149-156) both already include `journal` for the correct specialist roles.

**No registration needed. No security gap.** The Journal route is auth-protected (middleware line 212 blocks unauthenticated users), role-gated for specialist roles, and intentionally available to all subscription tiers. This matches the /pd architecture exactly.

#### The Actual Bug: Duplicate Render in JournalCard (Issue #35)

The previous analysis of the screenshot bug is correct. `JournalCard.tsx` reads `page.blocks` and renders the same data twice:
1. Lines 126-172: as a summary "entries list" (filtering blocks with content)
2. Lines 175-179: as a full `BlockEditor` (which renders the same blocks as editable document)

**The fix, per PD Rule 3 (Smallest Possible Change):** Delete lines 175-179 (the `BlockEditor` wrapper). The card keeps its entries list + quick-add form. Full editing stays in the standalone page. That's a ~5-line removal, not an architectural overhaul. The previous recommendation to "build a relational logs feed" violates Rule 3 — it proposes rewriting the data model when the visual bug is caused by rendering the same data twice.

#### Status Corrections

- **Issue 13** → changed from `[PENDING]` to `[FIXED]`. `RecordDetailPage.tsx` now passes `contextType` per database and `driveFolderId={boundDriveId}`. Auto-creates Drive folders on first load. Already shipped to `main`.
- **Issue 16** → changed from `[PENDING]` to `[FIXED]`. `RecordDetailPage.tsx` now maps `db-bobex` → "Bobex Pipeline" and `db-crm` → "Main Pipeline" in the breadcrumb. Already shipped to `main`.

#### Remaining Open Items — /pd Assessment

| # | Status | PD Risk | Assessment |
|---|--------|---------|------------|
| 14 | FIXED | **Rule 2** (Measure) | CRM pipeline — verified via runtime DevTools debugging. Zero console errors. Page loads cleanly with both pipeline tabs and records visible. |
| 26 | TODO | **Rule 1** (Scope) | Project billing rules — high-risk feature touching quotation engine + project management + invoicing. Three modules at once = large failure surface. Needs careful scoping and an implementation plan before touching code. |
| 27 | TODO | **Rule 1** (Scope) | Project cost rates — same scope risk as #26. These two should be planned together. |
| 28 | TODO | **Rule 6** (Build) | TypeScript loose variables — `tsc --noEmit` currently passes clean. These are likely ESLint warnings, not build blockers. Low priority. |
| 29 | TODO | **Rule 2** (Measure) | Project templates — need to verify what the current template flow actually produces before changing it. Measure first. |
| 33 | PARTIAL | **Rule 7** (Structure) | Custom selects — `SearchableSelect` rolled out to settings pages + task components + LinkedRecords + FilterBar. 18 native selects replaced total across 2 batches. 34 remain (mostly financial engine selects in invoices/quotations + database schema editor — lower priority). |
| 34 | DONE | **Rule 3** (Smallest) | Editable task titles — `EditableTitle` component in board view. Action bar with status (SearchableSelect), priority (click-to-cycle), due date (date picker). Fully functional. |

#### Recommended Priority (what to fix next)

1. **#14** — CRM crash. Runtime debugging needed (DevTools session).
2. **#33** — Custom selects. Systematic rollout using existing `SearchableSelect`.
3. **#34** — Editable task titles. Scope first.
4. **#26+27** — Project billing. Needs implementation plan first.
5. **#28+29** — Low priority cleanup/verification.

---

### Session 2026-05-24 (evening) — Financial Improvements + Footer Fix

45. [FIXED] Database footer horizontal scroll: The footer summary row (with column calculations and "New" button) was positioned outside the grid's horizontal scroll container. When the viewport was narrow and columns overflowed horizontally, the footer stayed fixed while the grid scrolled. Fix: added `footerScrollRef` synced via the same `onScrollCapture` → `translateX` pattern used for the header. Footer summary cells now scroll in lockstep with the grid and header columns.
46. [FIXED] Checkbox column not toggling on first click: DSG intercepts the first mousedown to activate the cell, so the component's `onClick` never fires on that initial click. Fix: added `useEffect` in `CheckboxColumn.tsx` that detects `active` transitioning `false→true` and toggles immediately. Subsequent clicks (when cell is already active) still work via `onClick`.
47. [FIXED] Font-size inconsistency across database grid columns: DSG native text inputs inherited the browser default (16px) while custom column components (Currency, Date, Title, Formula, etc.) used Tailwind's `text-sm` (14px). Fix: added global `font-size: 0.875rem` on `.database-grid-custom` with `inherit` rules for `.dsg-cell` and `.dsg-input`, normalizing all columns to 14px.
48. [FIXED] Financials module: Status auto-update logic correctly reflects credited invoices. Credit notes prepopulate with invoice blocks, and bidirectional links exist.
48. Financials module bug fix
    48.1 [TODO] - Status of invoices - must include credited. Add logic to Invoice engine to correctly update status of invoices - when an invoice is credited, the status should be updated to reflect the credit. 
    48.2 [TODO] - Credit memo's need to be added to the invoice as a separate line item. This is to avoid having to go to the credit memo page and then manually apply the credit memo to the invoice.
    48.3 [TODO] - Add links between the two - original invoice and the credit notes.
    48.4 [TODO] - The creditnota should find it's place in the appropriate database and not be visible in the invoices tab

49. [DONE] - Sent to accountant is supposed to be just a checkmark
50. [TODO] - Use Stripe API to generate qr codes and integrate them in the documents
51. [TODO] - check if developed do if not present - payments databases, incoming and outgoing and connection to projects and invoices
52. [TODO] - dashboard upgrade - cash flow and graph view
53. [FIXED] invoice creation engine - quoatations select - should be able to add more than one quoatation to an invoice - the calculation should be done automatically (implemented custom premium searchable multi-select selector and appends all priced blocks/calculations).
54. [FIXED] invoice creation engine - should display by "Betreft" instead of the number, when large databases (updated quotation lists/searches to format subject line followed by reference title/number).


### Session 2026-05-26 — Relational Crash & Panel Robustness

55. [FIXED] Relation field slice crash: raw relation values slice was crash-prone when they were non-string types. Added safe stringification `String(id || '')` to relational identifiers inside both `RelationValue` and `PropertyRow` subcomponents in `DbPropertiesPanel.tsx`.
56. [FIXED] Sidebar panels error isolation: Wrapped `<DbPropertiesPanel>` in a resilient `<ErrorBoundary>` wrapper inside `RecordDetailPage.tsx`, `ClientQuotationEngine.tsx`, and `ClientInvoiceEngine.tsx` to prevent minor database property schema issues from crashing the entire page or layout.

