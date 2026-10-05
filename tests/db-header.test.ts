import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeDatabaseHeader,
    type DatabaseHeaderContext,
} from '../src/lib/records/db-header.ts';

// ── 1. TITLE & BASICS ─────────────────────────────────────────────────────────

test('computeDatabaseHeader: formats title and row counts correctly', () => {
    const res = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Klanten',
        databaseIcon: '👤',
        totalRowCount: 42,
    });

    assert.equal(res.title.name, 'Klanten');
    assert.equal(res.title.icon, '👤');
    assert.equal(res.title.rowCount, 42);
    assert.equal(res.showViewTabs, true);
    assert.equal(res.toolbar.showProperties, true);
    assert.equal(res.toolbar.showFilter, true);
    assert.equal(res.toolbar.showSort, true);
    assert.equal(res.toolbar.showExportCsv, true);
    assert.equal(res.toolbar.showGridV2Toggle, true);
});

// ── 2. VIEW TABS & SCREEN TABS (Q1, C3) ──────────────────────────────────────

test('computeDatabaseHeader: CRM and Bobex always show view tabs (Q1) and carry screen tabs from data (C3)', () => {
    const screenTabs = [
        { id: 'tab-crm', label: 'CRM Pipeline', active: true },
        { id: 'tab-bobex', label: 'Bobex Pipeline', active: false },
    ];

    const res = computeDatabaseHeader({
        role: 'crm',
        databaseName: 'CRM',
        screenTabs,
    });

    // View tabs must be true (Q1: enables per-view filters and Kanban/Table views)
    assert.equal(res.showViewTabs, true);
    assert.deepEqual(res.screenTabs, screenTabs);
    assert.equal(res.actions.length, 0); // C4: No ad-hoc actions slipped in
});

test('computeDatabaseHeader: Projects carries project type tabs from data (C3)', () => {
    const screenTabs = [
        { id: 'all', label: 'All', active: true },
        { id: 'ops', label: 'Operations', active: false, filterValue: 'type-operations' },
    ];

    const res = computeDatabaseHeader({
        role: 'projects',
        databaseName: 'Projects',
        screenTabs,
    });

    assert.equal(res.showViewTabs, true);
    assert.deepEqual(res.screenTabs, screenTabs);
    assert.equal(res.actions.length, 0);
});

// ── 3. PARITY ACTIONS (C4) ────────────────────────────────────────────────────

test('computeDatabaseHeader: tickets declares exactly scan, bulk, and manual actions with i18n keys (C2, C4)', () => {
    const res = computeDatabaseHeader({
        role: 'tickets',
        databaseName: 'Tickets',
    });

    assert.equal(res.actions.length, 3);
    assert.equal(res.actions[0].id, 'scan-ticket');
    assert.equal(res.actions[0].labelKey, 'financials.expenses.scanTicket');
    assert.equal(res.actions[0].variant, 'primary');

    assert.equal(res.actions[1].id, 'bulk-upload-tickets');
    assert.equal(res.actions[1].labelKey, 'financials.expenses.bulkUpload');
    assert.equal(res.actions[1].variant, 'secondary');

    assert.equal(res.actions[2].id, 'manual-ticket');
    assert.equal(res.actions[2].labelKey, 'financials.expenses.manualEntry');
    assert.equal(res.actions[2].variant, 'outline');
});

test('computeDatabaseHeader: purchase invoices declares scan, manual, and peppol-sync actions (C4)', () => {
    const res = computeDatabaseHeader({
        role: 'expenses',
        surfaceKey: 'docType=opt-invoice',
        databaseName: 'Aankoopfacturen',
    });

    assert.equal(res.actions.length, 3);
    assert.equal(res.actions[0].id, 'scan-invoice');
    assert.equal(res.actions[0].labelKey, 'financials.expenses.scanInvoice');
    assert.equal(res.actions[0].variant, 'primary');

    assert.equal(res.actions[1].id, 'manual-invoice');
    assert.equal(res.actions[1].labelKey, 'financials.expenses.manualInvoice');
    assert.equal(res.actions[1].variant, 'outline');

    assert.equal(res.actions[2].id, 'peppol-sync');
    assert.equal(res.actions[2].labelKey, 'financials.expenses.peppolSync');
    assert.equal(res.actions[2].variant, 'badge');
});

test('computeDatabaseHeader: other screens have no declared actions (C4 parity constraint)', () => {
    const passiveRoles: Array<DatabaseHeaderContext['role']> = [
        'clients',
        'suppliers',
        'invoices',
        'payments-in',
        'payments-out',
        'quotations',
        'articles',
        'bestek',
        'custom',
    ];

    for (const role of passiveRoles) {
        const res = computeDatabaseHeader({
            role,
            databaseName: String(role),
        });
        assert.equal(res.actions.length, 0, `Role ${role} must not have ad-hoc actions under C4`);
    }
});

// ── 4. ACCOUNTANT EXPORT GATING (C1) ──────────────────────────────────────────

test('computeDatabaseHeader: accountant export visible ONLY for authorized sources and roles (C1)', () => {
    // Authorized source + authorized role
    const resAuth = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        userRole: 'ACCOUNTANT',
    });
    assert.equal(resAuth.toolbar.showAccountantExport, true);

    const resOwner = computeDatabaseHeader({
        role: 'expenses',
        databaseName: 'Expenses',
        userRole: 'OWNER',
    });
    assert.equal(resOwner.toolbar.showAccountantExport, true);

    const resTickets = computeDatabaseHeader({
        role: 'tickets',
        databaseName: 'Tickets',
        userRole: 'ADMIN',
    });
    assert.equal(resTickets.toolbar.showAccountantExport, true);

    // Authorized source + unauthorized role (EMPLOYEE)
    const resUnauth = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        userRole: 'EMPLOYEE',
    });
    assert.equal(resUnauth.toolbar.showAccountantExport, false);

    // Unauthorized source (clients) + authorized role (ACCOUNTANT)
    const resWrongSource = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        userRole: 'ACCOUNTANT',
    });
    assert.equal(resWrongSource.toolbar.showAccountantExport, false);
});

// ── 5. IMPORT, BULK APPROVE, & DELETE GATING ──────────────────────────────────

test('computeDatabaseHeader: import blocked for locked financial databases unless ungated', () => {
    // Standard financial doc -> Import CSV blocked
    const resLocked = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
    });
    assert.equal(resLocked.toolbar.showImportCsv, false);

    // Ungated financial doc -> Import CSV allowed
    const resUngated = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        isUngated: true,
    });
    assert.equal(resUngated.toolbar.showImportCsv, true);

    // Standard client database -> Import CSV allowed
    const resClients = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
    });
    assert.equal(resClients.toolbar.showImportCsv, true);

    // Bestek read-only -> Import CSV blocked
    const resBestek = computeDatabaseHeader({
        role: 'bestek',
        databaseName: 'Bestek',
        isBestekReadOnly: true,
    });
    assert.equal(resBestek.toolbar.showImportCsv, false);
});

test('computeDatabaseHeader: bulk approve only enabled for expenses inbox with selected rows', () => {
    // Expenses inbox with 3 selected rows -> Bulk approve visible
    const resInboxSelected = computeDatabaseHeader({
        role: 'expenses',
        activeViewId: 'vw-expenses-inbox',
        selectedRowCount: 3,
        databaseName: 'Expenses',
    });
    assert.equal(resInboxSelected.toolbar.showBulkApprove, true);

    // Expenses inbox with 0 selected rows -> Bulk approve hidden
    const resInboxZero = computeDatabaseHeader({
        role: 'expenses',
        activeViewId: 'vw-expenses-inbox',
        selectedRowCount: 0,
        databaseName: 'Expenses',
    });
    assert.equal(resInboxZero.toolbar.showBulkApprove, false);

    // Another database with selected rows -> Bulk approve hidden
    const resClients = computeDatabaseHeader({
        role: 'clients',
        selectedRowCount: 5,
        databaseName: 'Clients',
    });
    assert.equal(resClients.toolbar.showBulkApprove, false);
});

test('computeDatabaseHeader: delete shows draftOnlyDelete messageKey for invoices and expenses', () => {
    const resInv = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
    });
    assert.equal(resInv.toolbar.showBulkDelete, true);
    assert.equal(resInv.toolbar.preventDeleteMessageKey, 'admin.databases.draftOnlyDelete');

    const resExp = computeDatabaseHeader({
        role: 'expenses',
        databaseName: 'Expenses',
    });
    assert.equal(resExp.toolbar.showBulkDelete, true);
    assert.equal(resExp.toolbar.preventDeleteMessageKey, 'admin.databases.draftOnlyDelete');

    const resCust = computeDatabaseHeader({
        role: 'custom',
        databaseName: 'Custom',
    });
    assert.equal(resCust.toolbar.showBulkDelete, true);
    assert.equal(resCust.toolbar.preventDeleteMessageKey, undefined);
});

// ── 6. SCHEMA LINK PILL (C2) ──────────────────────────────────────────────────

test('computeDatabaseHeader: schema pill returns proper i18n labelKey and gating (C2)', () => {
    // Custom database: Edit Schema Fields
    const resCustom = computeDatabaseHeader({
        role: 'custom',
        databaseId: 'db-custom-1',
        databaseName: 'Custom',
    });
    assert.ok(resCustom.schemaLink);
    assert.equal(resCustom.schemaLink?.show, true);
    assert.equal(resCustom.schemaLink?.labelKey, 'admin.databases.editSchemaFields');
    assert.equal(resCustom.schemaLink?.href, '/admin/settings/databases/db-custom-1');

    // Articles / Bestek: Edit Custom Fields
    const resArticles = computeDatabaseHeader({
        role: 'articles',
        databaseId: 'db-articles',
        databaseName: 'Articles',
    });
    assert.ok(resArticles.schemaLink);
    assert.equal(resArticles.schemaLink?.labelKey, 'admin.databases.editCustomFields');

    // Locked financial database without ungated: hidden
    const resInvoices = computeDatabaseHeader({
        role: 'invoices',
        databaseId: 'db-invoices',
        databaseName: 'Invoices',
    });
    assert.equal(resInvoices.schemaLink, null);

    // Locked financial database WITH ungated: Edit Custom Fields
    const resInvoicesUngated = computeDatabaseHeader({
        role: 'invoices',
        databaseId: 'db-invoices',
        databaseName: 'Invoices',
        isUngated: true,
    });
    assert.ok(resInvoicesUngated.schemaLink);
    assert.equal(resInvoicesUngated.schemaLink?.show, true);
    assert.equal(resInvoicesUngated.schemaLink?.labelKey, 'admin.databases.editCustomFields');

    // Accountant user: schema pill always hidden
    const resAccountant = computeDatabaseHeader({
        role: 'custom',
        databaseName: 'Custom',
        isAccountant: true,
    });
    assert.equal(resAccountant.schemaLink, null);
});

// ── 7. THROW PROOFS ───────────────────────────────────────────────────────────

test('THROW PROOF: accountant export cannot leak to unauthorized roles or sources', () => {
    // If someone mutates the rule to check only isAccountantSource and ignores canRunAccountantExport:
    const ctx: DatabaseHeaderContext = {
        role: 'invoices',
        databaseName: 'Invoices',
        userRole: 'EMPLOYEE', // Not authorized
    };
    const res = computeDatabaseHeader(ctx);
    assert.equal(res.toolbar.showAccountantExport, false);

    // If mutated to unconditionally show accountant export:
    assert.doesNotThrow(() => {
        if (res.toolbar.showAccountantExport !== false) {
            throw new Error('LEAK: showAccountantExport showed for EMPLOYEE');
        }
    });
});

test('THROW PROOF: schemaLink returns only valid i18n keys, never raw visible text (C2)', () => {
    const res = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
    });

    assert.ok(res.schemaLink);
    // Throw proof: assert it never equals raw english string 'Edit Schema Fields'
    assert.notEqual(res.schemaLink.labelKey, 'Edit Schema Fields');
    assert.equal(res.schemaLink.labelKey, 'admin.databases.editSchemaFields');
});
