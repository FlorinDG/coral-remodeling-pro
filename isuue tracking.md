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

13. [PENDING] FileManager in RecordDetailPage: Uses `contextType="global"` which triggers a Google Drive fetch — but if `driveFolderId` is not passed, the `fetchNodes` effect skips execution (line 180 of `FileManager.tsx`). This means the Files card is always empty for record-level embeds. Needs: either a local-only file store or proper Drive folder mapping per-record.

14. [PENDING] CRM Main Pipeline page crash: Error boundary now catches it per-card. Root cause needs runtime investigation — likely a dynamic import or relation resolution issue specific to `db-crm` schema.

15. [PENDING] Journal module page: The breadcrumb link to Journal in the side nav should use the new Journal module (standalone page at `/admin/journal`), not the embedded BlockEditor.

16. [PENDING] Bobex Pipeline record pages: Breadcrumb shows "DB CRM" for both pipelines. The Bobex pipeline should show its own database name in the breadcrumb.

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
30. [TODO] Fix mobile bottom-nav to persist correctly when navigating to submodules like CRM or HR (currently it disappears on many routes).
31. [BUILT] Use less white space in dashboard to make better use of space.
32. [FIXED] Resolved all critical `react-hooks/set-state-in-effect` errors in app pages and components (LinkedRecords, ClientInvoiceEngine, ClientQuotationEngine, JournalEntryClient, PO/Bordereau templates, HR time-tracker pages) and verified that typechecking compiles 100% cleanly.