/**
 * DB-HEADER-1 · One Database Header Across the ERP
 * Canonical pure rule deciding screen tabs, view tabs, actions, toolbar buttons, and schema pill.
 *
 * Reuses canonical rules from their real homes (C1):
 * - canRunAccountantExport: src/lib/roles.ts
 * - ACCOUNTANT_EXPORT_SOURCES: src/lib/kernel/system-databases.ts
 * - systemDatabaseEntitled: src/lib/kernel/system-schema-entitlement.ts
 *
 * Rules:
 * - No visible text in the rule (C2): returns i18n keys for labels.
 * - Labels from data (C3): screenTabs come from data.
 * - Parity first (C4): only actions that exist today are declared.
 * - Serves both NotionGrid and NotionGridV2 (C6).
 */

import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { ACCOUNTANT_EXPORT_SOURCES } from '@/lib/kernel/system-databases';
import { canRunAccountantExport } from '@/lib/roles';

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
    showGridV2Toggle: boolean;
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
    isAccountant?: boolean;
    isImpersonating?: boolean;
    /** Tenant plan and entitlement. */
    planType?: string | null;
    activeModules?: string[];
    /** View & record state. */
    selectedRowCount?: number;
    totalRowCount?: number;
    activeViewType?: 'table' | 'board' | 'gallery' | 'calendar' | 'list' | 'timeline';
    activeViewId?: string | null;
    isLockedSchema?: boolean;
    isUngated?: boolean;
    hasDatabasesPermission?: boolean;
    gridV2Enabled?: boolean;
    /** For read-only gated bestek */
    isBestekReadOnly?: boolean;
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

/** Strictly locked system financial databases */
const FINANCIAL_DOCUMENT_ROLES: readonly (SystemDatabaseRole | 'custom')[] = [
    'invoices',
    'expenses',
    'tickets',
    'payments-in',
    'payments-out',
];

export function computeDatabaseHeader(ctx: DatabaseHeaderContext): DatabaseHeaderResult {
    const isFinancialDoc = FINANCIAL_DOCUMENT_ROLES.includes(ctx.role);
    const isAccountant = !!ctx.isAccountant;
    const isBestekReadOnly = !!ctx.isBestekReadOnly;
    const isUngated = !!ctx.isUngated || !!ctx.isSuperadmin;
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
            { id: 'scan-ticket', labelKey: 'financials.expenses.scanTicket', icon: 'camera', variant: 'primary' },
            { id: 'bulk-upload-tickets', labelKey: 'financials.expenses.bulkUpload', icon: 'files', variant: 'secondary' },
            { id: 'manual-ticket', labelKey: 'financials.expenses.manualEntry', icon: 'plus', variant: 'outline' }
        );
    } else if (ctx.role === 'expenses' && (!ctx.surfaceKey || ctx.surfaceKey === 'docType=opt-invoice')) {
        // Purchase invoices screen action bar
        actions.push(
            { id: 'scan-invoice', labelKey: 'financials.expenses.scanInvoice', icon: 'camera', variant: 'primary' },
            { id: 'manual-invoice', labelKey: 'financials.expenses.manualInvoice', icon: 'plus', variant: 'outline' },
            { id: 'peppol-sync', labelKey: 'financials.expenses.peppolSync', icon: 'refresh', variant: 'badge' }
        );
    }

    // 5. Toolbar Configuration
    const isAccountantSource =
        ctx.role !== 'custom' &&
        ACCOUNTANT_EXPORT_SOURCES.includes(ctx.role as SystemDatabaseRole);

    const showAccountantExport =
        isAccountantSource && canRunAccountantExport(ctx.userRole, ctx.isImpersonating);

    // Import is allowed unless accountant, read-only bestek, or locked financial doc (unless ungated)
    const showImportCsv =
        !isAccountant &&
        !isBestekReadOnly &&
        (!isFinancialDoc || isUngated);

    // Bulk approve: only for expenses inbox with selected rows
    const isExpensesInbox =
        ctx.role === 'expenses' &&
        (ctx.activeViewId === 'vw-expenses-inbox' || ctx.surfaceKey === 'inbox');
    const showBulkApprove = isExpensesInbox && selectedCount > 0;

    // Bulk delete: allowed unless accountant or read-only bestek
    const showBulkDelete = !isAccountant && !isBestekReadOnly;
    const preventDeleteMessageKey =
        ctx.role === 'invoices' || ctx.role === 'expenses'
            ? 'admin.databases.draftOnlyDelete'
            : undefined;

    const toolbar: ToolbarItemConfig = {
        showProperties: true,
        showFilter: true,
        showSort: true,
        showExportCsv: true,
        showAccountantExport,
        showImportCsv,
        showBulkApprove,
        showBulkDelete,
        showGridV2Toggle: true,
        preventDeleteMessageKey,
    };

    // 6. Schema Link Pill (C2: returns labelKey)
    let schemaLink: DatabaseHeaderResult['schemaLink'] = null;
    const resolvedId = ctx.databaseId || (ctx.role !== 'custom' ? ctx.role : 'custom');
    const href = `/admin/settings/databases/${resolvedId}`;

    if (!isAccountant) {
        if (isFinancialDoc) {
            // Locked schema — only visible when ungated
            if (isUngated) {
                schemaLink = {
                    show: true,
                    href,
                    labelKey: 'admin.databases.editCustomFields',
                };
            }
        } else if (ctx.role === 'articles' || ctx.role === 'bestek') {
            schemaLink = {
                show: true,
                href,
                labelKey: 'admin.databases.editCustomFields',
            };
        } else {
            // Custom or non-financial system DB (clients, suppliers, crm, bobex, projects, quotations)
            schemaLink = {
                show: true,
                href,
                labelKey: isUngated ? 'admin.databases.editCustomFields' : 'admin.databases.editSchemaFields',
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
