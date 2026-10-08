/**
 * DEC-1 · RATCHET — a browser `type="number"` field refuses the Belgian comma on a browser in another language
 * (Florin 2026-10-08). Every amount / price / quantity / percentage is typed in DecimalInput (lib/records/decimal).
 * What remains are WHOLE numbers (display order, next number, days, weeks, quota, spacer height) — this list may only
 * shrink; a new decimal field uses DecimalInput.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const WHOLE_NUMBER_FIELDS = new Set([
    'src/app/[locale]/admin/settings/company-info/page.tsx',      // next document number
    'src/app/[locale]/admin/settings/financials/page.tsx',        // payment terms (days)
    'src/app/[locale]/m/settings/MobileSettingsClient.tsx',       // next document number
    'src/app/[locale]/superadmin/TenantsGrid.tsx',                // monthly quota
    'src/components/admin/ProjectForm.tsx',                       // display order
    'src/components/admin/ServiceForm.tsx',                       // display order
    'src/components/admin/invoices/InvoiceRow.tsx',               // spacer height (px)
    'src/components/admin/quotations/QuotationRow.tsx',           // spacer height (px)
    'src/components/admin/tasks/RecurrenceSelector.tsx',          // every N (days/weeks)
    'src/components/admin/tasks/TaskDetailPanel.tsx',             // estimate (whole units)
    'src/components/time-tracker/components/schedule/shift-editor/CreateShiftForm.tsx',   // recurring weeks
    'src/components/time-tracker/components/schedule/shift-editor/EditShiftDialog.tsx',   // recurring weeks
]);

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
    });
}

test('DEC-1: no new browser number field — decimals are typed in DecimalInput', () => {
    const offenders = walk(join(ROOT, 'src'))
        .map(f => relative(ROOT, f))
        .filter(f => f !== 'src/components/ui/DecimalInput.tsx')
        .filter(f => /type="number"/.test(readFileSync(f, 'utf8')))
        .filter(f => !WHOLE_NUMBER_FIELDS.has(f));
    assert.deepEqual(offenders, [], `use DecimalInput (comma and point) instead of type="number" in: ${offenders.join(', ')}`);
});

test('DEC-1: the whole-number list only shrinks — a listed file without a number field leaves the list', () => {
    const stale = [...WHOLE_NUMBER_FIELDS].filter(f => !/type="number"/.test(readFileSync(join(ROOT, f), 'utf8')));
    assert.deepEqual(stale, [], `remove from WHOLE_NUMBER_FIELDS: ${stale.join(', ')}`);
});
