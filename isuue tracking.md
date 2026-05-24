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

14. [PENDING] CRM Main Pipeline page crash: Error boundary now catches it per-card. Root cause needs runtime investigation — likely a dynamic import or relation resolution issue specific to `db-crm` schema.

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
27. [TODO] Ensure project cost rates (person-hour, equipment) are properly saved to the project record and used to calculate project-level profitability (planned vs actual cost).
28. [TODO] Address "Not all variables are functions" TypeScript errors by either converting loose variables to computed getters or properly typing/scoping them within the component.
29. [TODO] Ensure all "Create Project From Template" functionality creates correct folder structures and populates the project with template tasks in a draft state, ready for refinement.
30. [FIXED] Mobile bottom-nav active state: The "More" tab in `MobileBottomNav.tsx` only highlighted for a few specific routes (settings, crm, db-clients, etc.), leaving routes like `/admin/contacts`, `/admin/financials`, `/admin/journal`, `/admin/library`, `/admin/quotations` with no active tab. Fix: "More" is now a catch-all that activates for any `/admin` route not claimed by the other 4 tabs (Home, Tasks, Projects, Calendar).
31. [BUILT] Use less white space in dashboard to make better use of space.
32. [FIXED] Resolved all critical `react-hooks/set-state-in-effect` errors in app pages and components (LinkedRecords, ClientInvoiceEngine, ClientQuotationEngine, JournalEntryClient, PO/Bordereau templates, HR time-tracker pages) and verified that typechecking compiles 100% cleanly.
33. [PARTIAL] Custom selects: Rolled out `SearchableSelect` replacement in Team Settings (access level), Company Info (interface language, document language, connector, date format, number width), and UI Settings (module selector). Remaining: financial engines, calendar, filter/sort toolbars, database schema editor, and other low-traffic pages.
34. [PARTIAL] Task board editable titles: Added `EditableTitle` component to `TaskBoardView.tsx`. Users can now click a task card title to edit inline — Enter/blur saves, Escape cancels. Wired via `onUpdateTitle` callback through `TaskModuleShell`. Remaining: action bar under title with status/priority/date controls.
35. [FIXED] Journal card duplicate render: `JournalCard.tsx` was rendering `page.blocks` data twice — once as a summary entries list at the top, and again via a full `BlockEditor` embed below. Fix: removed the `BlockEditor` entirely from the card. The card now shows only the chronological entries list + quick-add form. Full editing stays in the standalone journal page (`/admin/journal/[id]`). Also added an empty-state with a CTA when no entries exist.
36. [FIXED] Article library formula NaN: The formula chain had two bugs: (1) Percent values (e.g. Discount=20 meaning 20%) were multiplied directly instead of being divided by 100, producing `BruttoKost * 20` instead of `BruttoKost * (1 - 20/100)`. Same for Marge Standard. Fix: corrected `NettoKost` formula to `BruttoKost * (1 - Discount / 100)` and `Marge€` to `NettoKost * (Marge Standard / 100)`. (2) Added NaN guard in both the formula engine (returns 0 instead of NaN to prevent cascading) and `FormulaColumn.tsx` (displays "—" instead of "NaN").

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
| 14 | PENDING | **Rule 2** (Measure) | CRM pipeline crash — root cause unknown. Error boundary contains it (Rule 5 ✓). Needs runtime debugging session with DevTools to measure the actual error before proposing a fix. |
| 26 | TODO | **Rule 1** (Scope) | Project billing rules — high-risk feature touching quotation engine + project management + invoicing. Three modules at once = large failure surface. Needs careful scoping and an implementation plan before touching code. |
| 27 | TODO | **Rule 1** (Scope) | Project cost rates — same scope risk as #26. These two should be planned together. |
| 28 | TODO | **Rule 6** (Build) | TypeScript loose variables — `tsc --noEmit` currently passes clean. These are likely ESLint warnings, not build blockers. Low priority. |
| 29 | TODO | **Rule 2** (Measure) | Project templates — need to verify what the current template flow actually produces before changing it. Measure first. |
| 33 | PARTIAL | **Rule 7** (Structure) | Custom selects — `SearchableSelect` rolled out to 3 settings pages (team, company-info, UI). 8 native selects replaced. Remaining pages: financial engines, calendar, filter/sort toolbars, database schema editor. |
| 34 | PARTIAL | **Rule 3** (Smallest) | Editable task titles — `EditableTitle` component added to board view. Users click title to edit inline. Action bar under title (status/priority/dates) deferred — needs design input. |

#### Recommended Priority (what to fix next)

1. **#14** — CRM crash. Runtime debugging needed (DevTools session).
2. **#33** — Custom selects. Systematic rollout using existing `SearchableSelect`.
3. **#34** — Editable task titles. Scope first.
4. **#26+27** — Project billing. Needs implementation plan first.
5. **#28+29** — Low priority cleanup/verification.