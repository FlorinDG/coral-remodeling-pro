# CORAL — BLOCK INVENTORY — every building block, by tree level — Planner 2026-09-13

**Purpose:** a complete name-and-level list for a visual mindmap. **Placement is by where a block BELONGS under the new schema**, not where the file currently sits.

**Legend**
`△` = **currently sits at the wrong level** — the block exists, but above or below where it belongs
`✚` = **does not exist yet** — named because the layer needs it
*(everything unmarked exists and is at the right level)*

---

# L0 · KERNEL
*Primitives. No business meaning, no tenant awareness, no ERP concepts.*

## Persistence primitives
- `prisma` client singleton
- `encryption`
- `password`
- `schema-version`
- `build-marker`
- ✚ `TenantScopedClient` — the handle handed down through the gate
- ✚ `runForEachTenant` — tenant job runner *(R5)*

## I/O primitives
- `storage` — the one blob door *(the only closed kernel block today)*
- `fetch-retry`
- ✚ `messaging` — provider-agnostic SMS/email transport *(SMS-1)*

## Computation primitives
- `decimal-parser`
- `computeWorkedDuration`
- `formulaEngine`
- `formulaReference`
- `invoice-totals` △ *(business meaning — belongs L1)*
- `sortable-tree`
- `block-tree-dnd`
- `dnd-sensors`

## Interaction primitives
- `useScrollLock`
- `z-index` scale
- `useOverlayEventShield`
- `ErrorBoundary`
- `GlobalErrorHandler`
- `ServiceWorkerManager`
- ✚ desktop scroll/overlay parity

## Reference data
- `belgian-postcodes`
- `roles`
- `feature-flags`

---

# L1 · ERP CORE
*One way to read, one way to write, one way to schedule. Still tenant-agnostic.*

## Read / write path
- `usePagesOf` · `useLabelsOf` — read accessors
- `pageIndex`
- ✚ `saveRecord()` — the single write door *(R2-1)*
- ✚ field-level write intents *(R2-2)*
- ✚ "current record" authority *(R2-3)*
- `GlobalDatabaseSyncer`
- `database/store` △ *(module-level file holding a core concern)*

## Identity & access
- `auth` (NextAuth)
- `access-control`
- `moduleGuard`
- `plan-limits`
- `AuthProvider`

## Scheduled work
- ✚ job registry
- ✚ single `CRON_SECRET` verification *(currently copied 4×)*

## Document engine
- `generate-pdf`
- `pdf-stationery`
- `document-i18n`
- `docNumberFallback`
- ✚ unified document engine *(R4)*

## Money primitives
- `invoice-totals`
- `ogm`
- `stripe`
- `dunning`
- `trial`

## System data
- `systemDatabases`
- `provisionTenantDbs`
- `lockedDbUtils`
- `databaseRoute`
- `schema-cleanup`

## Platform services
- `notifications`
- `email`
- `languageLogic`
- `i18n` message catalogue
- `useUserPreferences`

---

# ⛨ THE TENANT GATE — THE SERAPH
*Everything above is tenant-agnostic. Everything below RECEIVES scope and cannot reach past it.*

- `TenantContext` △ *(is a React context; the gate must also exist server-side)*
- `Tenant.lockedDbIds`
- ✚ fail-closed `resolveDbId` *(R1-2 — replaces `(base) => base`)*
- ✚ `logicalKey` on `GlobalDatabase` *(R1-1b)*
- ✚ server-side id resolution — never trust a supplied id *(R1-3)*
- ✚ scoped accessor + CI import gate *(R1-4/5)*
- ✚ `tenant-isolation` negative test suite — **the closure condition**
- `impersonateTenant` — the one legitimate door
- `verifySuperadmin`
- `emergency-access`
- ✚ client-side seraph — IndexedDB / store isolation on tenant switch

---

# L2 · MODULES
*Business domains. Each receives scope; none reaches past the gate.*

- **Database / Records** — the Notion-like substrate
- **Invoices**
- **Quotations**
- **Expenses**
- **Purchases**
- **Financials / Accountant export**
- **Tasks**
- **Projects**
- **HR / Workforce**
- **Time tracking**
- **CRM / Contacts**
- **Suppliers**
- **Client Portal**
- **Files / Documents**
- **Email**
- **Calendar**
- **Spreadsheet**
- **CMS / Storefront**
- **Bookings & Leads**
- **Peppol / e-Invoicing**
- **Superadmin**
- **Reminders** ✚
- **Notifications**
- **Search**

---

# ⛨ MODULE GATES
*Rules a module may not be talked out of.*

- `export-lock` — accountant-exported records are read-only
- `document-archive` — archive before send, abort on failure
- **Blob strictness** — all-or-nothing accountant export
- **Offline sync queue** — never silently drop a write
- `moduleGuard` / plan entitlement
- `LockedFeature`
- `EnvBadge` · `VersionWatcher` · `SyncStatusBadge`
- ✚ schema declaration gate — no undeclared property

---

# L3 · SUBMODULES
*Named capabilities inside a module.*

## Database / Records
- `NotionGrid`
- `columns`
- `views` — Board · Kanban · Calendar · Gantt · Timeline
- `FilterToolbar` · `SortToolbar`
- `ColumnHeader` · `AddColumnFlyout` · `PropertiesDropdown` · `DbPropertiesPanel`
- `BlockEditor`
- `PageModal` · `RecordDetailPage`
- `LinkedRecords`
- `SelectDropdown`
- `VariantsPropertyEditor`
- `FormulaEditorModal`
- `SpreadsheetImportModal`
- `PropertyMentionBlock` · `PropMentionFlyout` · `GlobalMentionDateInterceptor`
- `DatabaseClone`
- `mockData` — seed schemas

## Tasks
- `subtasks`
- `RecurrenceEngine` · `RecurrenceSelector`
- `TaskListView` · `TaskBoardView` · `TaskRow`
- `TaskDetailPanel` · `TaskQuickAdd` · `TaskContextMenu` · `TaskSidebar`
- `PerspectiveBuilder`
- `ReviewMode`
- `TaskModuleShell`
- ✚ reminder scheduling
- ✚ attachments *(mobile only today)*

## Invoices / Quotations
- `ClientInvoiceEngine`
- `ClientQuotationEngine`
- `quote-service`
- `payment-plan-service` · `payments`
- `e-invoice` · `e-invoice-inbox`
- `peppol-ubl` · `peppol-payload`
- `SmartVATLookup`
- `SupplierQuotationsCard`
- `bordereau` · `po`

## Projects
- `ProjectDetailView`
- `ProjectCockpit`
- `PageFinancialAnalysis`
- `JournalCard`
- `ProjectForm` · `ProjectList` · `ProjectUpdateForm`

## Expenses
- `expense-dedup`
- `expense-taxonomy`
- `ocr` · `scan`
- `integrations/parse-pdf`

## HR / Time
- `timesheets`
- `timesheet-rates` · `RateChangeAudit`
- `ClockEntry` · `ScheduledShift` · `ShiftTemplate`
- `WorkerSchedule` · `TimeOffRequest`
- `HrTeam` · `HrAnnouncement` · `HrDocument`
- `resolveWorkerIdentity`
- `AuditLog`

## Files
- `FileManager`
- `FileViewer`
- `google-drive` · `googleToken`
- `attachment-link`

## Portal
- `PortalLogin` · `ChatBox` · `DocumentManager` · `MediaManager` · `TaskManager`
- `PortalGrid` · `PortalSettings` · `CreatePortalModal`

## Shells & navigation
- `AdminLayout` · `Topbar` · `AdminHeader` · `ModuleTabs` · `Breadcrumbs`
- `WorkHubShell` · `WorkHubProviders`
- `MobileShell` · `MobileAppScope` · `MobileBottomNav`
- `SuperadminLayout`
- `useSidebarStore` · `useTabStore` · `useBreadcrumbStore`
- `QuickSearch` · `UniversalSearch`

---

# L4 · LEAVES
*What the user touches.*

## Design system
- `ui/*` — button, input, dialog, sheet, drawer, popover, select, table, tabs, toast, tooltip, calendar, command, sidebar, chart, carousel, and the rest of the shadcn set
- `CustomDatePicker` · `DateRangePicker` · `SearchableSelect` · `ScopePicker` · `Checkbox`
- `ThemeProvider` · `ThemeToggle` · `Logo`
- `BottomSheet`

## Admin screens
`dashboard` · `database` · `dynamic-db` · `tasks` · `projects` · `projects-management` · `quotations` · `financials` · `hr` · `crm` · `contacts` · `suppliers` · `files` · `email` · `calendar` · `spreadsheet` · `journal` · `library` · `portals` · `services` · `content` · `websites` · `settings`

## Mobile screens
`m/tasks` · `m/tasks/settings` · `m/invoices` · `m/quotes` · `m/expenses` · `m/purchases` · `m/clients` · `m/files` · `m/settings`

## Public & portal screens
`home` · `services` · `store` · `faq` · `help` · `eula` · `privacy` · `terms` · `login` · `accept-invite` · `reset-password` · `portal/[slug]` · `invoice/[id]` · `quote/[id]`

## Marketing surfaces
- `Hero` · `Navbar` · `Footer` · `ServiceExpander` · `ServiceDetailClient` · `ProjectGallery` · `BookingModal` · `BookingModule` · `LeadForm` · `PromotionalBanner` · `CookieConsent` · `JsonLd` · `LanguageSwitcher`

---

# ⟂ CROSS-CUTTING — sits beside the tree, not in it

- **Data model** — 55 Prisma models, `GlobalDatabase` / `GlobalPage` chief among them
- **Test suite** — `tests/*.test.ts`
- **CI gates** — import boundaries, grep gates, `test:compile`
- **`.agents/workflows`** — the specs
- **Cron schedule** — `vercel.json`
- **Deployment** — Vercel envs, Neon branches
