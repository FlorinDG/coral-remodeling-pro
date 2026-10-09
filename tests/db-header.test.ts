import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    computeDatabaseHeader,
    type DatabaseHeaderContext,
} from '../src/lib/records/db-header.ts';
import { gridAccess, EXPENSES_INBOX_VIEW } from '../src/lib/records/grid-access.ts';

const FULL_ACCESS = { edit: true, create: true, delete: true };

const LOCALES = ['nl', 'en', 'fr', 'ro'] as const;
type Locale = typeof LOCALES[number];

const allMessages: Record<Locale, Record<string, unknown>> = {
    nl: JSON.parse(readFileSync(join(process.cwd(), 'src/messages/nl.json'), 'utf8')),
    en: JSON.parse(readFileSync(join(process.cwd(), 'src/messages/en.json'), 'utf8')),
    fr: JSON.parse(readFileSync(join(process.cwd(), 'src/messages/fr.json'), 'utf8')),
    ro: JSON.parse(readFileSync(join(process.cwd(), 'src/messages/ro.json'), 'utf8')),
};

function getTranslation(path: string, locale: Locale = 'nl'): string | undefined {
    const parts = path.split('.');
    let curr: unknown = allMessages[locale];
    for (const part of parts) {
        if (!curr || typeof curr !== 'object') return undefined;
        curr = (curr as Record<string, unknown>)[part];
    }
    return typeof curr === 'string' ? curr : undefined;
}

// ── 1. TITLE & BASICS ─────────────────────────────────────────────────────────

test('computeDatabaseHeader: formats title and row counts correctly', () => {
    const res = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Klanten',
        databaseIcon: '👤',
        totalRowCount: 42,
        access: FULL_ACCESS,
        activeViewType: 'table',
    });

    assert.equal(res.title.name, 'Klanten');
    assert.equal(res.title.icon, '👤');
    assert.equal(res.title.rowCount, 42);
    assert.equal(res.showViewTabs, true);
    assert.equal(res.toolbar.showProperties, true);
    assert.equal(res.toolbar.showFilter, true);
    assert.equal(res.toolbar.showSort, true);
    assert.equal(res.toolbar.showExportCsv, true);
    assert.equal(res.toolbar.showWrapText, true);
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
        access: FULL_ACCESS,
    });

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
        access: FULL_ACCESS,
    });

    assert.equal(res.showViewTabs, true);
    assert.deepEqual(res.screenTabs, screenTabs);
    assert.equal(res.actions.length, 0);
});

// ── 3. PARITY ACTIONS (C4, R4) ────────────────────────────────────────────────

test('computeDatabaseHeader: tickets declares exactly scan and bulk — no manual entry (Florin 2026-10-07) — with valid i18n keys', () => {
    const res = computeDatabaseHeader({
        role: 'tickets',
        databaseName: 'Tickets',
        access: FULL_ACCESS,
    });

    assert.equal(res.actions.length, 2);
    assert.equal(res.actions[0].id, 'scan-ticket');
    assert.equal(res.actions[0].labelKey, 'Admin.nav.pages.scanUploadTicket');
    assert.equal(res.actions[0].variant, 'primary');

    assert.equal(res.actions[1].id, 'bulk-upload-tickets');
    assert.equal(res.actions[1].labelKey, 'Admin.nav.pages.bulkUploadTickets');
    assert.equal(res.actions[1].variant, 'secondary');

    // Every key resolves in nl.json
    for (const act of res.actions) {
        const tr = getTranslation(act.labelKey);
        assert.ok(tr && tr.length > 0, `Action key ${act.labelKey} must resolve in nl.json`);
    }
});

test('computeDatabaseHeader: purchase invoices declares scan and peppol-sync — no manual entry — with valid i18n keys', () => {
    const res = computeDatabaseHeader({
        role: 'expenses',
        surfaceKey: 'docType=opt-invoice',
        databaseName: 'Aankoopfacturen',
        access: FULL_ACCESS,
    });

    assert.equal(res.actions.length, 3);
    assert.equal(res.actions[0].id, 'scan-invoice');
    assert.equal(res.actions[0].labelKey, 'Admin.nav.pages.scanUpload');
    assert.equal(res.actions[0].variant, 'primary');

    assert.equal(res.actions[1].id, 'peppol-sync');
    assert.equal(res.actions[1].labelKey, 'Admin.nav.pages.syncPeppolInbox');
    assert.equal(res.actions[1].variant, 'badge');

    // LINE-SEARCH-1: search the lines of purchase invoices and supplier quotes
    assert.equal(res.actions[2].id, 'search-lines');
    assert.equal(res.actions[2].labelKey, 'Admin.dbHeader.searchLines');

    for (const act of res.actions) {
        const tr = getTranslation(act.labelKey);
        assert.ok(tr && tr.length > 0, `Action key ${act.labelKey} must resolve in nl.json`);
    }
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
            access: FULL_ACCESS,
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
        access: gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'invoices', isEnterprise: false }),
    });
    assert.equal(resAuth.toolbar.showAccountantExport, true);

    const resOwner = computeDatabaseHeader({
        role: 'expenses',
        databaseName: 'Expenses',
        userRole: 'OWNER',
        access: gridAccess({ userRole: 'OWNER', logicalKey: 'expenses', isEnterprise: false }),
    });
    assert.equal(resOwner.toolbar.showAccountantExport, true);

    const resTickets = computeDatabaseHeader({
        role: 'tickets',
        databaseName: 'Tickets',
        userRole: 'ADMIN',
        access: gridAccess({ userRole: 'ADMIN', logicalKey: 'tickets', isEnterprise: false }),
    });
    assert.equal(resTickets.toolbar.showAccountantExport, true);

    // Authorized source + unauthorized role (EMPLOYEE)
    const resUnauth = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        userRole: 'EMPLOYEE',
        access: gridAccess({ userRole: 'EMPLOYEE', logicalKey: 'invoices', isEnterprise: false }),
    });
    assert.equal(resUnauth.toolbar.showAccountantExport, false);

    // Unauthorized source (clients) + authorized role (ACCOUNTANT)
    const resWrongSource = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        userRole: 'ACCOUNTANT',
        access: gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'clients', isEnterprise: false }),
    });
    assert.equal(resWrongSource.toolbar.showAccountantExport, false);
});

// ── 5. IMPORT, BULK APPROVE, & DELETE GATING (R1, R2, R6) ─────────────────────

test('computeDatabaseHeader: import blocked for locked schema or lack of create access (R2)', () => {
    // Locked schema -> Import CSV blocked
    const resLocked = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        access: FULL_ACCESS,
        isLockedSchema: true,
    });
    assert.equal(resLocked.toolbar.showImportCsv, false);

    // Unlocked schema with create access -> Import CSV allowed
    const resUnlocked = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        access: FULL_ACCESS,
        isLockedSchema: false,
    });
    assert.equal(resUnlocked.toolbar.showImportCsv, true);

    // Accountant (create = false) -> Import CSV blocked
    const resAccountant = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        access: gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'clients', isEnterprise: false }),
        isLockedSchema: false,
    });
    assert.equal(resAccountant.toolbar.showImportCsv, false);

    // Bestek without enterprise (create = false) -> Import CSV blocked
    const resBestek = computeDatabaseHeader({
        role: 'bestek',
        databaseName: 'Bestek',
        access: gridAccess({ userRole: 'ADMIN', logicalKey: 'bestek', isEnterprise: false }),
        isLockedSchema: false,
    });
    assert.equal(resBestek.toolbar.showImportCsv, false);
});

test('computeDatabaseHeader: bulk approve only enabled for expenses inbox with selected rows (R1)', () => {
    // Expenses inbox with 3 selected rows -> Bulk approve visible
    const resInboxSelected = computeDatabaseHeader({
        role: 'expenses',
        activeViewId: EXPENSES_INBOX_VIEW,
        selectedRowCount: 3,
        databaseName: 'Expenses',
        access: FULL_ACCESS,
    });
    assert.equal(resInboxSelected.toolbar.showBulkApprove, true);

    // Expenses inbox with 0 selected rows -> Bulk approve hidden
    const resInboxZero = computeDatabaseHeader({
        role: 'expenses',
        activeViewId: EXPENSES_INBOX_VIEW,
        selectedRowCount: 0,
        databaseName: 'Expenses',
        access: FULL_ACCESS,
    });
    assert.equal(resInboxZero.toolbar.showBulkApprove, false);

    // Another view id -> Bulk approve hidden
    const resOtherView = computeDatabaseHeader({
        role: 'expenses',
        activeViewId: 'vw-other',
        selectedRowCount: 3,
        databaseName: 'Expenses',
        access: FULL_ACCESS,
    });
    assert.equal(resOtherView.toolbar.showBulkApprove, false);
});

test('computeDatabaseHeader: delete shows draftOnlyDelete messageKey for invoices and expenses (R2, R4)', () => {
    const resInv = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        access: FULL_ACCESS,
    });
    assert.equal(resInv.toolbar.showBulkDelete, true);
    assert.equal(resInv.toolbar.preventDeleteMessageKey, 'Admin.dbHeader.draftOnlyDelete');
    assert.ok(getTranslation(resInv.toolbar.preventDeleteMessageKey!));

    const resExp = computeDatabaseHeader({
        role: 'expenses',
        databaseName: 'Expenses',
        access: FULL_ACCESS,
    });
    assert.equal(resExp.toolbar.showBulkDelete, true);
    assert.equal(resExp.toolbar.preventDeleteMessageKey, 'Admin.dbHeader.draftOnlyDelete');
    assert.ok(getTranslation(resExp.toolbar.preventDeleteMessageKey!));

    const resCust = computeDatabaseHeader({
        role: 'custom',
        databaseName: 'Custom',
        access: FULL_ACCESS,
    });
    assert.equal(resCust.toolbar.showBulkDelete, true);
    assert.equal(resCust.toolbar.preventDeleteMessageKey, undefined);

    // Delete blocked when access.delete is false
    const resNoDelete = computeDatabaseHeader({
        role: 'invoices',
        databaseName: 'Invoices',
        access: { edit: true, create: true, delete: false },
    });
    assert.equal(resNoDelete.toolbar.showBulkDelete, false);
});

test('computeDatabaseHeader: wrap text is only shown on table views (R6)', () => {
    const resTable = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        access: FULL_ACCESS,
        activeViewType: 'table',
    });
    assert.equal(resTable.toolbar.showWrapText, true);

    const resBoard = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        access: FULL_ACCESS,
        activeViewType: 'board',
    });
    assert.equal(resBoard.toolbar.showWrapText, false);
});

// ── 6. SCHEMA LINK PILL (C2, R4, R5) ──────────────────────────────────────────

test('computeDatabaseHeader: schema pill returns null if databaseId is missing (R5)', () => {
    const resNoId = computeDatabaseHeader({
        role: 'clients',
        databaseName: 'Clients',
        access: FULL_ACCESS,
        databaseId: null,
    });
    assert.equal(resNoId.schemaLink, null);
});

test('computeDatabaseHeader: schema pill returns proper i18n labelKey and gating (C2, R4, R5)', () => {
    // Custom database: Edit Schema Fields
    const resCustom = computeDatabaseHeader({
        role: 'custom',
        databaseId: 'db-custom-1',
        databaseName: 'Custom',
        access: FULL_ACCESS,
    });
    assert.ok(resCustom.schemaLink);
    assert.equal(resCustom.schemaLink?.show, true);
    assert.equal(resCustom.schemaLink?.labelKey, 'Admin.dbHeader.editSchemaFields');
    assert.equal(resCustom.schemaLink?.href, '/admin/settings/databases/db-custom-1');
    assert.ok(getTranslation(resCustom.schemaLink!.labelKey));

    // Articles / Bestek: Edit Custom Fields
    const resArticles = computeDatabaseHeader({
        role: 'articles',
        databaseId: 'db-articles',
        databaseName: 'Articles',
        access: FULL_ACCESS,
    });
    assert.ok(resArticles.schemaLink);
    assert.equal(resArticles.schemaLink?.labelKey, 'Admin.dbHeader.editCustomFields');
    assert.ok(getTranslation(resArticles.schemaLink!.labelKey));

    // Locked financial database without ungated: hidden
    const resInvoices = computeDatabaseHeader({
        role: 'invoices',
        databaseId: 'db-invoices',
        databaseName: 'Invoices',
        access: FULL_ACCESS,
        isLockedSchema: true,
        isUngated: false,
    });
    assert.equal(resInvoices.schemaLink, null);

    // Locked financial database WITH ungated: Edit Custom Fields
    const resInvoicesUngated = computeDatabaseHeader({
        role: 'invoices',
        databaseId: 'db-invoices',
        databaseName: 'Invoices',
        access: FULL_ACCESS,
        isLockedSchema: true,
        isUngated: true,
    });
    assert.ok(resInvoicesUngated.schemaLink);
    assert.equal(resInvoicesUngated.schemaLink?.show, true);
    assert.equal(resInvoicesUngated.schemaLink?.labelKey, 'Admin.dbHeader.editCustomFields');
    assert.ok(getTranslation(resInvoicesUngated.schemaLink!.labelKey));

    // Accountant user: edit access is false -> schema pill hidden
    const resAccountant = computeDatabaseHeader({
        role: 'custom',
        databaseId: 'db-custom-1',
        databaseName: 'Custom',
        access: gridAccess({ userRole: 'ACCOUNTANT', logicalKey: 'custom', isEnterprise: false }),
    });
    assert.equal(resAccountant.schemaLink, null);
});

// ── 7. THROW PROOFS ───────────────────────────────────────────────────────────

test('THROW PROOF: accountant export cannot leak to unauthorized roles or sources', () => {
    const ctx: DatabaseHeaderContext = {
        role: 'invoices',
        databaseName: 'Invoices',
        userRole: 'EMPLOYEE', // Not authorized
        access: gridAccess({ userRole: 'EMPLOYEE', logicalKey: 'invoices', isEnterprise: false }),
    };
    const res = computeDatabaseHeader(ctx);
    assert.equal(res.toolbar.showAccountantExport, false);

    assert.doesNotThrow(() => {
        if (res.toolbar.showAccountantExport !== false) {
            throw new Error('LEAK: showAccountantExport showed for EMPLOYEE');
        }
    });
});

test('THROW PROOF: every returned i18n key resolves to a valid string across all locales (nl, en, fr, ro) (R4)', () => {
    // Generate results for multiple combinations
    const testCases: DatabaseHeaderContext[] = [
        { role: 'tickets', databaseName: 'Tickets', databaseId: 'db-tickets', access: FULL_ACCESS },
        { role: 'expenses', surfaceKey: 'docType=opt-invoice', databaseName: 'Expenses', databaseId: 'db-expenses', access: FULL_ACCESS },
        { role: 'invoices', databaseName: 'Invoices', databaseId: 'db-invoices', access: FULL_ACCESS },
        { role: 'clients', databaseName: 'Clients', databaseId: 'db-clients', access: FULL_ACCESS },
        { role: 'custom', databaseName: 'Custom', databaseId: 'db-custom', access: FULL_ACCESS },
    ];

    for (const locale of LOCALES) {
        for (const ctx of testCases) {
            const res = computeDatabaseHeader(ctx);

            for (const act of res.actions) {
                const tr = getTranslation(act.labelKey, locale);
                if (!tr) throw new Error(`[${locale}] Missing translation for action key: ${act.labelKey}`);
            }

            if (res.toolbar.preventDeleteMessageKey) {
                const tr = getTranslation(res.toolbar.preventDeleteMessageKey, locale);
                if (!tr) throw new Error(`[${locale}] Missing translation for preventDeleteMessageKey: ${res.toolbar.preventDeleteMessageKey}`);
            }

            if (res.schemaLink) {
                const tr = getTranslation(res.schemaLink.labelKey, locale);
                if (!tr) throw new Error(`[${locale}] Missing translation for schemaLink.labelKey: ${res.schemaLink.labelKey}`);
            }
        }
    }
});

test('PROFORMA-2: the proformas screen declares "Nieuwe proforma" — the one way a proforma is made; other invoice screens do not', () => {
    const pf = computeDatabaseHeader({ role: 'invoices', surfaceKey: 'docType=opt-proforma', databaseName: 'Facturen', access: FULL_ACCESS } as DatabaseHeaderContext);
    assert.deepEqual(pf.actions.map(a => a.id), ['new-proforma']);
    for (const l of LOCALES) assert.ok(getTranslation(pf.actions[0].labelKey.replace(/^Admin\./, 'Admin.'), l), `missing ${l}`);
    const inv = computeDatabaseHeader({ role: 'invoices', surfaceKey: 'docType=opt-invoice', databaseName: 'Facturen', access: FULL_ACCESS } as DatabaseHeaderContext);
    assert.deepEqual(inv.actions, []);
});

test('a purchase document comes WITH its document: no CSV import on purchase invoices / tickets; other databases keep it (throw proof)', () => {
    for (const role of ['expenses', 'tickets'] as const) {
        assert.equal(computeDatabaseHeader({ role, databaseName: 'x', access: FULL_ACCESS } as DatabaseHeaderContext).toolbar.showImportCsv, false, role);
    }
    assert.equal(computeDatabaseHeader({ role: 'clients', databaseName: 'Klanten', access: FULL_ACCESS } as DatabaseHeaderContext).toolbar.showImportCsv, true);
});

test('LINE-SEARCH-1 / QUOTE-IN-1: supplier quotes — scan and the line search, no CSV import', () => {
    const res = computeDatabaseHeader({ role: 'purchase-quotes', databaseName: 'Offertes leveranciers', access: FULL_ACCESS });
    assert.deepEqual(res.actions.map(a => a.id), ['scan-invoice', 'search-lines']);
    assert.equal(res.toolbar.showImportCsv, false);
    for (const act of res.actions) assert.ok(getTranslation(act.labelKey), `${act.labelKey} must resolve in nl.json`);
});
