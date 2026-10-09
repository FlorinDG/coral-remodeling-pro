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
