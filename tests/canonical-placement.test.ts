/**
 * Canonical placement (Florin 2026-10-09: "keep yourself to the canonical logic. put parts where they belong").
 * Each rule has ONE home; these guards fail when a copy appears at the edge again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { newDocumentLine } from '../src/lib/records/document-lines.ts';
import { SALES_VAT_REGIMES, documentRateOf, isReverseCharge } from '../src/lib/records/vat-regime.ts';

const SRC = new URL('../src/', import.meta.url).pathname;
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
});
const ALL = files(SRC);
const read = (p: string) => readFileSync(p, 'utf8');
const rel = (p: string) => p.slice(SRC.length);

test('app shells prepare their databases through the ONE door (lib/data/tenant-databases), never inline', () => {
    const shells = ALL.filter(p => /app\/\[locale\]\/[^/]+\/layout\.tsx$/.test(p));
    assert.ok(shells.length >= 3);
    for (const p of shells) {
        const src = read(p);
        assert.doesNotMatch(src, /provisionLockedDatabases|reconcileSystemSchemas/, `${rel(p)} prepares databases inline`);
        assert.doesNotMatch(src, /getGlobalDatabases|getGlobalPageIndex/, `${rel(p)} loads the store's data itself — use DatabaseBootstrap`);
    }
});

test('the store data streams behind the shell — the loader is under <Suspense> in the admin and mobile shells', () => {
    for (const shell of ['app/[locale]/admin/layout.tsx', 'app/[locale]/m/layout.tsx']) {
        assert.match(read(join(SRC, shell)), /<Suspense[^>]*>\s*<DatabaseBootstrap/, shell);
    }
});

test('the VAT regimes are listed ONCE (lib/records/vat-regime) — no screen writes its own list', () => {
    assert.deepEqual(SALES_VAT_REGIMES, ['21', '12', '6', '0', 'medecontractant']);
    for (const p of ALL.filter(p => !p.endsWith('lib/records/vat-regime.ts'))) {
        const src = read(p);
        assert.doesNotMatch(src, /<option value="(21|12|6|0|medecontractant)">/, `${rel(p)} lists VAT regimes itself`);
        assert.doesNotMatch(src, /\[\s*21\s*,\s*12\s*,\s*6\s*,\s*0\s*\]/, `${rel(p)} lists VAT rates itself`);
    }
    assert.equal(documentRateOf('medecontractant'), 0);
    assert.equal(documentRateOf(undefined), 21);
    assert.ok(isReverseCharge('medecontractant'));
});

test('a line is built ONE way (newDocumentLine) — its rate stored only when set by hand to a different one', () => {
    const same = newDocumentLine({ id: 'a', content: 'x', quantity: 2, unitPrice: 5, rate: 21 }, '21');
    assert.equal('vatRateOverride' in same, false);
    assert.equal(same.unitPrice, 5);
    assert.equal(same.verkoopPrice, 5);
    const own = newDocumentLine({ id: 'b', content: 'y', quantity: 1, unitPrice: 5, rate: 6 }, '21');
    assert.equal(own.vatRateOverride, 6);
    for (const p of ['app/[locale]/m/invoices/new/page.tsx', 'lib/data/timesheet-invoicing.ts']) {
        assert.match(read(join(SRC, p)), /newDocumentLine\(/, `${p} builds its lines itself`);
    }
});

test('formatting lives in lib/format — the totals rule formats nothing', () => {
    assert.doesNotMatch(read(join(SRC, 'lib/invoice-totals.ts')), /Intl\.NumberFormat|export function format/);
});

test('the VAT regime is named in core — no screen compares to \'medecontractant\' or falls back to \'21\' itself', () => {
    // PENDING EDITOR-1 (PR #2 touches these files): remove from this list once it is merged — the list may only shrink.
    const PENDING = new Set([
        'components/admin/invoices/InvoiceRow.tsx', 'components/admin/quotations/QuotationRow.tsx',
        'components/admin/invoices/FinancialRowRenderer.tsx', 'components/admin/quotations/FinancialRowRenderer.tsx',
    ]);
    const LITERAL = /[!=]==\s*'medecontractant'|\|\|\s*'21'\b|\?\?\s*'21'\b|vatRegime\s*=\s*'21'|type\s+VatRegime\s*=/;
    const offenders = ALL.filter(p => !p.endsWith('lib/records/vat-regime.ts') && !PENDING.has(rel(p)) && LITERAL.test(read(p))).map(rel);
    assert.deepEqual(offenders, []);
    assert.ok(PENDING.size <= 4);
});

test('a calendar day is the BUSINESS day (kernel zonedParts / addDaysYmd) — never toISOString() (the UTC day)', () => {
    const UTC_DAY = /toISOString\(\)\.(split\(['"]T['"]\)\[0\]|slice\(0, ?10\)|substring\(0, ?10\))/g;
    const count = (p: string) => (read(p).match(UTC_DAY) || []).length;
    // Money and legal dates: zero, always (Peppol, invoices, quotes, credit notes, purchases, payments)
    const FINANCIAL = /^(lib\/peppol|lib\/invoice|components\/admin\/(invoices|quotations|expenses)\/|app\/\[locale\]\/m\/(invoices|purchases|expenses))/;
    assert.deepEqual(ALL.filter(p => FINANCIAL.test(rel(p)) && count(p) > 0).map(rel), []);
    // Everywhere else: a RATCHET — the total may only go down (lower it as files are fixed; never raise it)
    const CEILING = 31;
    const total = ALL.reduce((n, p) => n + count(p), 0);
    assert.ok(total <= CEILING, `${total} UTC-day dates (ceiling ${CEILING}) — use zonedParts(new Date()).date`);
});
