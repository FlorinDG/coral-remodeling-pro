/**
 * DB-HEADER-1 · One Database Header Across the ERP
 * Canonical pure rule deciding screen tabs, view tabs, actions, toolbar buttons, and schema pill.
 *
 * Reuses canonical rules from their real homes (C1, R1):
 * - canRunAccountantExport: src/lib/roles.ts
 * - ACCOUNTANT_EXPORT_SOURCES: src/lib/kernel/system-databases.ts
 * - gridAccess, EXPENSES_INBOX_VIEW: src/lib/records/grid-access.ts
 *
 * Rules:
 * - R1: Who may change: ONE rule (re-uses access: GridAccess from gridAccess).
 * - R2: Import / delete gates: access.create && !ctx.isLockedSchema, access.delete.
 * - R3: showGridV2Toggle not modeled in rule (left in DatabaseClone).
 * - R4: All returned keys must exist in messages/*.json.
 * - R5: No databaseId -> no schemaLink.
 * - R6: showWrapText for table views; unused context pruned.
 */

import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { ACCOUNTANT_EXPORT_SOURCES } from '@/lib/kernel/system-databases';
import { canRunAccountantExport } from '@/lib/roles';
import type { GridAccess } from '@/lib/records/grid-access';
import { EXPENSES_INBOX_VIEW } from '@/lib/records/grid-access';

export interface ScreenTabItem {
    id: string;
    label: string;
    icon?: string;
    active: boolean;
    filterValue?: string;
}

export type ActionId =
    | 'scan-ticket'
    | 'bulk-upload-tickets'
    | 'manual-ticket'
    | 'scan-invoice'
    | 'manual-invoice'
    | 'peppol-sync';

export interface ActionItem {
    id: ActionId;
    labelKey: string;
    icon: 'camera' | 'files' | 'plus' | 'check' | 'alert' | 'refresh';
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
    showWrapText: boolean;
    preventDeleteMessageKey?: string;
}

export interface DatabaseHeaderContext {
    /** The canonical system database role, or 'custom' for user-created databases. */
    role: SystemDatabaseRole | 'custom';
    /** Surface key from VIEW-SCOPE-1 (e.g. 'docType=opt-invoice', 'prop-project-type=type-operations', or null). */
    surfaceKey?: string | null;
    /** Current database name and icon. */
    databaseName: string;
    databaseIcon?: string | null;
    databaseId?: string | null;
    /** User context for permission gating. */
    userRole?: string | null;
    isSuperadmin?: boolean;
    isImpersonating?: boolean;
    /** Permission and access gates from gridAccess(...) */
    access: GridAccess;
    /** View & record state. */
    selectedRowCount?: number;
    totalRowCount?: number;
    activeViewType?: 'table' | 'board' | 'gallery' | 'calendar' | 'list' | 'timeline';
    activeViewId?: string | null;
    isLockedSchema?: boolean;
    isUngated?: boolean;
    /** Optional screen tabs (e.g. CRM pipelines or Project types) */
    screenTabs?: ScreenTabItem[] | null;
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
        labelKey: string;
    } | null;
}

export function computeDatabaseHeader(ctx: DatabaseHeaderContext): DatabaseHeaderResult {
    const selectedCount = ctx.selectedRowCount ?? 0;
    const totalCount = ctx.totalRowCount ?? 0;

    // 1. Title
    const title = {
        name: ctx.databaseName,
        icon: ctx.databaseIcon ?? null,
        rowCount: totalCount,
    };

    // 2. Screen Tabs (C3: from data)
    const screenTabs = ctx.screenTabs && ctx.screenTabs.length > 0 ? ctx.screenTabs : null;

    // 3. View Tabs (Q1: always enabled across all databases including CRM)
    const showViewTabs = true;

    // 4. Declared Actions (C4: Parity first — only existing actions)
    const actions: ActionItem[] = [];
    if (ctx.role === 'tickets') {
        actions.push(
            { id: 'scan-ticket', labelKey: 'Admin.nav.pages.scanUploadTicket', icon: 'camera', variant: 'primary' },
            { id: 'bulk-upload-tickets', labelKey: 'Admin.nav.pages.bulkUploadTickets', icon: 'files', variant: 'secondary' },
            { id: 'manual-ticket', labelKey: 'Admin.nav.pages.manualTicket', icon: 'plus', variant: 'outline' }
        );
    } else if (ctx.role === 'expenses' && (!ctx.surfaceKey || ctx.surfaceKey === 'docType=opt-invoice')) {
        actions.push(
            { id: 'scan-invoice', labelKey: 'Admin.nav.pages.scanUpload', icon: 'camera', variant: 'primary' },
            { id: 'manual-invoice', labelKey: 'Admin.nav.pages.manualInvoice', icon: 'plus', variant: 'outline' },
            { id: 'peppol-sync', labelKey: 'Admin.nav.pages.syncPeppolInbox', icon: 'refresh', variant: 'badge' }
        );
    }

    // 5. Toolbar Configuration
    const isAccountantSource =
        ctx.role !== 'custom' &&
        ACCOUNTANT_EXPORT_SOURCES.includes(ctx.role as SystemDatabaseRole);

    const showAccountantExport =
        isAccountantSource && canRunAccountantExport(ctx.userRole, ctx.isImpersonating);

    // R2: Import gate = access.create && !ctx.isLockedSchema
    const showImportCsv = ctx.access.create && !ctx.isLockedSchema;

    // R1: Bulk approve for expenses inbox with selected rows
    const isExpensesInbox =
        ctx.role === 'expenses' &&
        ctx.activeViewId === EXPENSES_INBOX_VIEW;
    const showBulkApprove = isExpensesInbox && selectedCount > 0;

    // R2: Bulk delete gate = access.delete
    const showBulkDelete = ctx.access.delete;
    const preventDeleteMessageKey =
        ctx.role === 'invoices' || ctx.role === 'expenses'
            ? 'Admin.dbHeader.draftOnlyDelete'
            : undefined;

    // R6: Wrap text toggle enabled for table views
    const showWrapText = !ctx.activeViewType || ctx.activeViewType === 'table';

    const toolbar: ToolbarItemConfig = {
        showProperties: true,
        showFilter: true,
        showSort: true,
        showExportCsv: true,
        showAccountantExport,
        showImportCsv,
        showBulkApprove,
        showBulkDelete,
        showWrapText,
        preventDeleteMessageKey,
    };

    // 6. Schema Link Pill (R5: no databaseId -> no link; respects edit access & lockedSchema)
    let schemaLink: DatabaseHeaderResult['schemaLink'] = null;
    if (ctx.databaseId && ctx.access.edit) {
        if (!ctx.isLockedSchema || ctx.isUngated) {
            schemaLink = {
                show: true,
                href: `/admin/settings/databases/${ctx.databaseId}`,
                labelKey: (ctx.isUngated || ctx.role === 'articles' || ctx.role === 'bestek')
                    ? 'Admin.dbHeader.editCustomFields'
                    : 'Admin.dbHeader.editSchemaFields',
            };
        }
    }

    return {
        title,
        screenTabs,
        showViewTabs,
        actions,
        toolbar,
        schemaLink,
    };
}
