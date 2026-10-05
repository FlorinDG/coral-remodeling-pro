# DB-HEADER-1 PLAN — One Database Header Across the ERP

Item:            DB-HEADER-1
Directive:       .agents/workflows/coder-directive-db-header-1.md
Start SHA:       5d3b3998
Branch:          develop
Date:            2026-10-05

---

## 1 · Inventory of All 19 Database Screens

Below is the complete inventory of the 19 screens rendering databases via `DatabaseClone` / `NotionGrid`, audited at Start SHA `5d3b3998`.

| # | Screen File & Line | Database Role / Target | Title | Screen Tabs | View Tabs | Toolbar Buttons | Page Action Bar | Schema Pill | Inconsistencies / Defects |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `contacts/page.tsx:21` | `clients` (`db-clients`) | Grid default (`database.name` + count) | None (`ModuleTabs` at page top) | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Schema Fields" | Standard grid; no action bar. |
| 2 | `crm/page.tsx:61` (Main) | `crm` (`db-crm`) | Replaced by `headerTabs` | Hardcoded "Main Pipeline" / "Bobex Pipeline" | ❌ **Hidden** (`hideViewTabs`) | Props, Filter, Sort, Export, Import, Delete | None | ❌ **Hidden** | View tabs hidden: cannot switch between Table and Board views, cannot scope filters per view under VIEW-SCOPE-1. Hardcoded English labels. |
| 3 | `crm/page.tsx:61` (Bobex) | `bobex` (`db-bobex`) | Replaced by `headerTabs` | Hardcoded "Main Pipeline" / "Bobex Pipeline" | ❌ **Hidden** (`hideViewTabs`) | Props, Filter, Sort, Export, Import, Delete | None | ❌ **Hidden** | Same as above for Bobex pipeline. |
| 4 | `projects-management/page.tsx:69` | `projects` (`db-1`) | None (hidden) | 4 type tabs above grid ("All", "Operations", "Admin", "BizDev") | Yes (`hideViewTabs={false}`) | Props, Filter, Sort, Export, Import, Delete | ❌ **Separate custom bar** | Type tabs rendered outside grid in ad-hoc div, while CRM renders pipeline tabs inside `headerExtra`. Re-mounts `DatabaseClone` on tab switch (`key={activeType}`). |
| 5 | `quotations/page.tsx:29` | `quotations` (`db-quotations`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Schema Fields" | `hideFooterNew` passed, but no header action to create quotation. |
| 6 | `financials/income/invoices/page.tsx:30` | `invoices` (`db-invoices`, `docType=opt-invoice`) | Grid default | None | Yes (`surfaceKey: docType=opt-invoice`) | Props, Filter, Sort, Export, Accountant Export, Delete (draft-only) | None | Locked (hidden) | Has Accountant Export, but no top action bar (unlike purchase invoices). `hideFooterNew` passed. |
| 7 | `financials/income/credit-notes/page.tsx:23` | `invoices` (`db-invoices`, `docType=opt-credit-note`) | Grid default | None | Yes (`surfaceKey: docType=opt-credit-note`) | Props, Filter, Sort, Export, Accountant Export, Delete (draft-only) | None | Locked (hidden) | Same database as invoices, shares accountant export, but no top action bar. |
| 8 | `financials/income/proformas/page.tsx:25` | `invoices` (`db-invoices`, `docType=opt-proforma`) | Grid default | None | Yes (`surfaceKey: docType=opt-proforma`) | Props, Filter, Sort, Export, Accountant Export, Delete (draft-only) | None | Locked (hidden) | Same database as invoices, `hideFooterNew` passed. |
| 9 | `financials/income/payments/page.tsx:24` | `payments-in` (`db-payments-in`) | Grid default | None | Yes | Props, Filter, Sort, Export, Delete | None | Locked (hidden) | No accountant export, no action bar. |
| 10 | `financials/expenses/invoices/page.tsx:230` | `expenses` (`db-expenses`, `docType=opt-invoice`) | Grid default | None | Yes (`surfaceKey: docType=opt-invoice`) | Props, Filter, Sort, Export, Accountant Export, Bulk Approve (inbox), Delete | ❌ **Separate custom bar** (Scan, Manual, Peppol status & sync) | Locked (hidden) | Huge custom action bar rendered in page above `DatabaseClone`, taking up vertical space and separated from grid toolbar. |
| 11 | `financials/expenses/credit-notes/page.tsx:22` | `expenses` (`db-expenses`, `docType=opt-credit-note`) | Grid default | None | Yes (`surfaceKey: docType=opt-credit-note`) | Props, Filter, Sort, Export, Accountant Export, Delete | None | Locked (hidden) | Shares `db-expenses` with purchase invoices, but completely lacks the Scan/Manual bar! |
| 12 | `financials/expenses/tickets/page.tsx:90` | `tickets` (`db-tickets`) | Grid default | None | Yes | Props, Filter, Sort, Export, Accountant Export, Delete | ❌ **Separate custom bar** (Scan, Bulk upload, Manual entry) | Locked (hidden) | Another separate custom action bar rendered above `DatabaseClone` with distinct buttons and styling. |
| 13 | `financials/expenses/payments/page.tsx:24` | `payments-out` (`db-payments-out`) | Grid default | None | Yes | Props, Filter, Sort, Export, Delete | None | Locked (hidden) | Standard grid without action bar. |
| 14 | `library/articles/page.tsx:30` | `articles` (`db-articles`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Custom Fields" | PRO and up library database. |
| 15 | `library/bestek/page.tsx:34` | `bestek` (`db-bestek`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import (read-only gated), Delete (read-only gated) | None | "Edit Custom Fields" | Has `isBestekReadOnly` hardcoded in `NotionGrid` checking role/system status. |
| 16 | `database/page.tsx:14` | Generic fallback (`db-1`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Schema Fields" | Fallback dev route. |
| 17 | `database/[databaseId]/page.tsx:22` | Dynamic user DB (`[databaseId]`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Schema Fields" | Custom tenant database. |
| 18 | `dynamic-db/page.tsx:28` | Dynamic first DB (`databases[0].id`) | Grid default | None | Yes | Props, Filter, Sort, Export, Import, Delete | None | "Edit Schema Fields" | Dynamic viewer route. |
| 19 | `projects-management/planning/page.tsx:34` (or secondary project view) | `projects` (`db-1`, timeline) | Custom page header | Timeline view | ❌ None (GanttView) | None | None | None | Uses `GanttView` directly instead of `DatabaseClone`, but represents the 19th database view surface. |

---

## 2 · Canonical Header Rule (`src/lib/records/db-header.ts`)

### Signature & Types
```typescript
import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';

export interface DatabaseHeaderContext {
    /** The canonical system database role, or 'custom' for user-created databases. */
    role: SystemDatabaseRole | 'custom';
    /** Surface key from VIEW-SCOPE-1 (e.g. 'docType=opt-invoice', 'prop-project-type=type-operations', or null). */
    surfaceKey?: string | null;
    /** Current database name and icon. */
    databaseName: string;
    databaseIcon?: string | null;
    /** User context for permission gating. */
    userRole?: string | null;
    isSuperadmin?: boolean;
    isAccountant?: boolean;
    /** Tenant plan and entitlement. */
    planType?: string | null;
    activeModules?: string[];
    /** View & record state. */
    selectedRowCount?: number;
    totalRowCount?: number;
    activeViewType?: 'table' | 'board' | 'gallery' | 'calendar' | 'list';
    activeViewId?: string | null;
    isLockedSchema?: boolean;
    isUngated?: boolean;
    hasDatabasesPermission?: boolean;
    gridV2Enabled?: boolean;
}

export interface ScreenTabItem {
    id: string;
    label: string;
    icon?: string;
    active: boolean;
    filterValue?: string;
}

export interface ActionItem {
    id: 'scan-ticket' | 'bulk-upload-tickets' | 'manual-ticket' | 'scan-invoice' | 'manual-invoice' | 'peppol-sync' | 'new-record';
    labelKey: string;
    icon: 'camera' | 'files' | 'plus' | 'check' | 'alert';
    variant: 'primary' | 'secondary' | 'outline' | 'badge';
    badgeContent?: string;
}

export interface ToolbarItemConfig {
    showProperties: boolean;
    showFilter: boolean;
    showSort: boolean;
    showExportCsv: boolean;
    showAccountantExport: boolean;
    showImportCsv: boolean;
    showBulkApprove: boolean;
    showBulkDelete: boolean;
    showGridV2Toggle: boolean;
    preventDeleteMessage?: string;
}

export interface DatabaseHeaderResult {
    title: {
        name: string;
        icon?: string | null;
        rowCount: number;
    };
    /** Top-level screen tabs (e.g. CRM pipelines, Project types) when applicable. */
    screenTabs: ScreenTabItem[] | null;
    /** View tabs config (Table, Board, etc.) — always enabled unless pure single-view. */
    showViewTabs: boolean;
    /** Declared page actions (rendered in the action slot). */
    actions: ActionItem[];
    /** Grid toolbar items config. */
    toolbar: ToolbarItemConfig;
    /** Schema link button config. */
    schemaLink: {
        show: boolean;
        href: string;
        label: 'Edit Schema Fields' | 'Edit Custom Fields';
    } | null;
}

export function computeDatabaseHeader(ctx: DatabaseHeaderContext): DatabaseHeaderResult;
```

### Table of Rules: Role / Screen / Plan / User Mapping
Existing canonical rules are reused without duplication:
- `canRunAccountantExport(role, userRole)` from `@/lib/accountant-export`
- `ACCOUNTANT_EXPORT_SOURCES` from `@/lib/accountant-export`
- `systemDatabaseEntitled(role, planType, activeModules)` from `@/lib/kernel/system-schema-entitlement`
- `isTenantDatabase(databaseId, role)` from `@/lib/kernel/system-databases`

| Database Role | Screen / Surface | Screen Tabs | View Tabs | Declared Actions | Toolbar Items | Schema Pill |
|---|---|---|---|---|---|---|
| `crm` / `bobex` | `/admin/crm` | Pipeline tabs derived from DB names | ✅ **Show** (enables Board/Table views per pipeline) | None | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show if ungated |
| `projects` | `/admin/projects-management` | Project Type tabs (All, Operations, Admin, BizDev) | ✅ Show | None (record creation via grid or modal) | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show |
| `tickets` | `/admin/financials/expenses/tickets` | None | ✅ Show | `scan-ticket`, `bulk-upload-tickets`, `manual-ticket` | Props, Filter, Sort, Export, AccountantExport, Delete (draft-only), GridV2 | Locked (hidden) |
| `expenses` | `/admin/financials/expenses/invoices` | None | ✅ Show | `scan-invoice`, `manual-invoice`, `peppol-sync` | Props, Filter, Sort, Export, AccountantExport, BulkApprove (inbox), Delete (draft-only), GridV2 | Locked (hidden) |
| `expenses` | `/admin/financials/expenses/credit-notes` | None | ✅ Show | `manual-invoice` (create credit note) | Props, Filter, Sort, Export, AccountantExport, Delete (draft-only), GridV2 | Locked (hidden) |
| `invoices` | `/admin/financials/income/invoices` | None | ✅ Show | `manual-invoice` (create invoice) | Props, Filter, Sort, Export, AccountantExport, Delete (draft-only), GridV2 | Locked (hidden) |
| `invoices` | `/admin/financials/income/credit-notes` | None | ✅ Show | `manual-invoice` (create credit note) | Props, Filter, Sort, Export, AccountantExport, Delete (draft-only), GridV2 | Locked (hidden) |
| `invoices` | `/admin/financials/income/proformas` | None | ✅ Show | None | Props, Filter, Sort, Export, AccountantExport, Delete (draft-only), GridV2 | Locked (hidden) |
| `payments-in` | `/admin/financials/income/payments` | None | ✅ Show | None | Props, Filter, Sort, Export, Delete, GridV2 | Locked (hidden) |
| `payments-out` | `/admin/financials/expenses/payments` | None | ✅ Show | None | Props, Filter, Sort, Export, Delete, GridV2 | Locked (hidden) |
| `quotations` | `/admin/quotations` | None | ✅ Show | `new-record` | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show |
| `clients` | `/admin/contacts` | None | ✅ Show | None | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show |
| `suppliers` | `/admin/suppliers` | None | ✅ Show | None | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show |
| `articles` | `/admin/library/articles` | None | ✅ Show | None | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show ("Edit Custom Fields") |
| `bestek` | `/admin/library/bestek` | None | ✅ Show | None | Props, Filter, Sort, Export, Import (read-only gated), Delete (read-only gated), GridV2 | Show ("Edit Custom Fields") |
| `custom` | `/admin/database/[databaseId]` | None | ✅ Show | `new-record` | Props, Filter, Sort, Export, Import, Delete, GridV2 | Show ("Edit Schema Fields") |

---

## 3 · The Component & Unified Layout

### Component Location
`src/components/admin/database/components/DatabaseHeader.tsx`

### Visual Structure
A two-level unified header:
1. **Top Row (Brand & Screen Context):**
   - Left: Icon + Title + Row count badge OR Screen Tabs (for multi-pipeline CRM and multi-type Projects).
   - Right: Declared Action Items (Scan, Bulk Upload, Manual, Peppol status badge) + Schema Pill (`Edit Custom Fields` / `Edit Schema Fields`).
2. **Bottom Row (View & Grid Navigation):**
   - Left: View Tabs (`Table`, `Board`, `List`, `Gallery`, `+ Add View`).
   - Right: Grid Toolbar (Properties, Filter, Sort, Export CSV, Accountant Export, Import CSV, Raster V2 Toggle, Bulk Approve, Bulk Delete).

When a screen does NOT have declared action items or screen tabs, the layout collapses gracefully into a single compact bar, preserving maximum vertical screen space for the data grid.

---

## 4 · Milestones

- **M1: Pure Rule & Characterization Tests**
  - Implement `src/lib/records/db-header.ts` with `computeDatabaseHeader(ctx)`.
  - Implement `tests/db-header.test.ts` covering all 19 screens, role permissions, accountant export gating, and schema pill rules.
  - Include throw proofs verifying failure on rule mutation.
  - Run compile, lint, and full test suite.
  - Review point: Pure logic approved before UI changes.

- **M2: Unified Header Component**
  - Implement `src/components/admin/database/components/DatabaseHeader.tsx`.
  - Connect handlers for view switching, renaming, adding views, actions, and toolbar triggers.
  - Integrate with `DatabaseClone.tsx` behind a component boundary.

- **M3: Migrate Financials Screens (8 Screens)**
  - Migrate `tickets`, `expenses/invoices`, `expenses/credit-notes`, `expenses/payments`, `income/invoices`, `income/credit-notes`, `income/proformas`, `income/payments`.
  - Remove page-level ad-hoc action bars from `tickets/page.tsx` and `expenses/invoices/page.tsx`. Pass action handlers (`onScan`, `onBulk`, `onManual`) into the unified header.

- **M4: Migrate CRM & Projects (2 Screens / 3 Surfaces)**
  - Migrate `crm/page.tsx`: replace hardcoded English tabs with canonical screen tabs; **enable view tabs** so CRM gains Table/Board switching and view-scoped filters.
  - Migrate `projects-management/page.tsx`: fold the outer `TYPE_TABS` into the canonical header's screen tabs slot.

- **M5: Migrate Library & Contacts Screens (5 Screens)**
  - Migrate `articles`, `bestek`, `contacts`, `suppliers`, `quotations`.
  - Reconcile `isBestekReadOnly` into the pure rule.

- **M6: Migrate Generic / Dynamic Database Screens (3 Screens) & Cleanup**
  - Migrate `database/page.tsx`, `database/[databaseId]/page.tsx`, `dynamic-db/page.tsx`.
  - Remove obsolete redundant header code from `DatabaseClone.tsx` and `NotionGrid.tsx`.
  - Final compile, lint, and test pass across all 19 screens.

---

## 5 · What Florin Can Click Through After Each Milestone

- **After M1:** Run `node --import ./tests/register.mjs --test tests/db-header.test.ts` to see 100% green pure rule test coverage across all 19 screens.
- **After M2:** Open any standard database (e.g. `/admin/contacts`) and see the new unified header layout rendering smoothly with intact properties, filter, and sort flyouts.
- **After M3:** Open `/admin/financials/expenses/tickets` and `/admin/financials/expenses/invoices` — observe that the scan, manual entry, bulk upload, and Peppol sync buttons are cleanly aligned in the unified header rather than sitting in a clunky top banner.
- **After M4:** Open `/admin/crm` — observe pipeline tabs using canonical database names and view tabs visible, allowing switching between Table and Board views with distinct filters. Open `/admin/projects-management` — project type tabs are seamlessly integrated in the header.
- **After M5 & M6:** Click through all 19 screens across Financials, CRM, Projects, Library, and Custom databases — the entire ERP has 100% consistent typography, padding, toolbar ordering, and view controls.

---

## 6 · Open Questions

1. **Should CRM show view tabs?**
   **Proposal:** YES. Today CRM sets `hideViewTabs={true}`, which prevents users from creating or using Kanban Board views for their deal pipeline and breaks VIEW-SCOPE-1 (filters cannot be separated across views). The unified header will show view tabs for CRM, enabling Kanban and Table views per pipeline.
2. **Action button styling:**
   Should primary actions (e.g. "Scan / Upload Ticket", "Scan Invoice") share a single standard accent button style (`bg-orange-500 text-white rounded-lg`) across all modules, replacing the ad-hoc mix of indigo, orange, and gray buttons?
   **Proposal:** Yes, canonical design system styling with consistent lucide icons.
3. **Accountant Export placement:**
   Today Accountant Export sits between Export and Import in the grid toolbar.
   **Proposal:** Keep it on the grid toolbar, visible only when `canRunAccountantExport(role, userRole)` returns true.

---

## PLANNER REVIEW — 2026-10-05 · ✅ APPROVED WITH CORRECTIONS · GO for M1 only (stop after M1)
A good inventory — every screen, every inconsistency named. Corrections, binding:

**C1 · Reuse the real rules, from their real homes.** `canRunAccountantExport` is in `src/lib/roles.ts`;
`ACCOUNTANT_EXPORT_SOURCES` and `systemDatabaseEntitled` are kernel (`src/lib/kernel/system-databases.ts`,
`system-schema-entitlement.ts`). `isTenantDatabase` is a CLIENT helper (`lib/relations/resolve.ts`) — the pure rule
must not import it: it receives the database's ROLE (logicalKey) in its context, and decides from that.

**C2 · No visible text in the rule.** The rule returns i18n KEYS (`schemaLink.labelKey`, action `labelKey`, tab keys)
— never 'Edit Schema Fields'. The component translates (next-intl, en/nl/fr/ro).

**C3 · Labels come from DATA.** CRM pipeline tabs = the databases' own names (now "CRM" / "Bobex" — renamed by SQL
today). Project-type tabs = the options of the `prop-project-type` select in the projects schema (plus "All"),
not a hard-coded list.

**C4 · Parity first — no new behaviour slipped in.** The table proposes actions that do not exist today
(`manual-invoice` on invoices / credit notes, `new-record` on quotations / custom). M1–M6 move what EXISTS into the
one header; new actions go to §6 as questions for Florin.

**C5 · Styling:** one primary action style on the tenant's brand colour (`var(--brand-color)`), never a hard-coded
orange-500. Lucide icons, as proposed.

**C6 · The header serves BOTH grids.** GRID-REPLACE is under way (NotionGridV2 behind "Raster V2"). The toolbar
(Properties, Filter, Sort, Export, Import, accountant export, bulk approve) moves OUT of NotionGrid into the one
header, and NotionGridV2 renders under the same header — the rule's `gridV2Enabled` decides nothing about which
items show. Moving code OUT of NotionGrid is allowed (R3-C freeze = no new behaviour inside it).

**Answers:** Q1 yes — CRM shows view tabs (Florin: filters per view). Q2 yes, per C5. Q3 yes.
#19 (planning / Gantt) is not a DatabaseClone screen — out of scope, noted.
M1 = `src/lib/records/db-header.ts` + `tests/db-header.test.ts` (node:test, throw proofs) + report. Push, STOP.

## PLANNER REVIEW — M1 · 2026-10-05 · ✅ ACCEPTED (inert: nothing imports it) · corrections R1–R6 land FIRST in M2
Read `3ee25c65` + report `20d1c1fb`. C1 kernel/roles reuse for the accountant export ✅, C2 keys not text ✅, C3 tabs
from data ✅, C4 actions = what exists ✅. But it re-derives rules that already have a home — the thing C1 forbids:

**R1 · Who may change: ONE rule.** `lib/records/grid-access.ts` already holds it (`gridAccess`: the accountant reads,
the bestek read-only below ENTERPRISE; `EXPENSES_INBOX_VIEW`; `licensedColumns`). The context takes
`access: GridAccess` (the caller passes `gridAccess(...)`), not `isAccountant` / `isBestekReadOnly` flags; the inbox
test uses `EXPENSES_INBOX_VIEW`. Delete `surfaceKey === 'inbox'` — no such surface key exists (`view-scope surfaceKey`
is `field=value`).
**R2 · Import / delete gates = the grid's today.** Import: `access.create && !ctx.isLockedSchema` (the screen already
computes `lockedSchema`); delete: `access.delete` — the per-row guard (`preventDelete`) stays the screen's, the door
refuses issued documents. Drop the own `FINANCIAL_DOCUMENT_ROLES` list for these.
**R3 · `showGridV2Toggle`** — SUPERSEDED 2026-10-05 by GRID-REPLACE-4: the new grid is the default; the switch is
now "Oud raster" for EVERY user (table views) until 2026-10-12, then deleted at GRID-REPLACE-5. Do not model it in
the rule — leave it in DatabaseClone where it is.
**R4 · The keys must exist.** 8 of 9 returned keys are not in `src/messages/*.json` (`draftOnlyDelete`,
`editCustomFields`, `editSchemaFields`, `scanTicket`, `bulkUpload`, `manualEntry`, `scanInvoice`, `peppolSync`).
Reuse the keys the screens use today where they exist; add the rest in en/nl/fr/ro. Throw proof: a test that every
key the rule can return resolves in `nl.json`.
**R5 · Schema link:** no `databaseId` → no link (the fallback `/admin/settings/databases/<role>` is not a database).
**R6 · Unused context** (`planType`, `activeModules`, `hasDatabasesPermission`, `gridV2Enabled`, `activeViewType`):
remove what the rule does not decide from (C6: `gridV2Enabled` decides nothing).
**New since M1:** the V2 toolbar gained "Tekst afbreken" (per-view `wrapText`) — add `showWrapText` (table views).
GO M2 after R1–R6.
