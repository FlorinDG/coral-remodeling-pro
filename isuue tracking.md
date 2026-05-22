### This is where we will keep track of issues.


1. Connected Properties card: backlinking should be bi-directional 
2 Expenses > approval: Add "Reject" button alongside approve 
3. Expenses > approval: In "Reject" mode, the field for adding a comment should be enabled. 
4. three levels of settings Superadmin environment - in here ALL available/existing settings have to appear., ERP configuration e.g. database schema, tenant configuration - settings that control the ERP app itself to which users are locked out of, specific to the tenant/user environment, where users manage their own business settings.
5. When on mobile, the app should have a more streamlined design, with a bottom navigation bar for the main modules. The current design is too desktop-focused and not optimized for mobile use.
6. HR module - Employee profiles should have a more developed, comprehensive design. 

7. Workforce app - the Work Hub tab in the HR module should be the homepage of the mobile app. needs to be highly optimised for mobile. 
8. the entire HR module needs serious work - it has to be accessible on it's own, standalone webapp. every other required connection should be properly setup, tasks, file storage, projects, approvals, etc. 

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

21. HR module - documents - id, photo's, contracts, and other required documents, need a database to hold them all, and the folder in the storage 
22. create a module for documents - contracts, disputes, everything that is in support of business, from which any module can connect. create storage folder for module
23. advancement state document in project managemen, that can be turned into invoice. add functionality to quotation - button in the bottom row "Create Vorderingstaat" - this opens a pop-up window where user can select the items from the quotation and create a vorderingstaat from them. This should appear in the projects module, in the project's detail view, in a tab called "Vorderingenstaten", also with a button to invoice them.