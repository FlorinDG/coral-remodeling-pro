/**
 * Florin 2026-10-10: "timesheets — projects select/filter — not the canonical component, has no search bar".
 * Lists that grow (projects, workers) are picked with the canonical SearchableSelect on every timesheet screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SCREENS = [
    'src/app/[locale]/admin/hr/timesheets/TimesheetFilterBar.tsx',
    'src/app/[locale]/admin/hr/timesheets/ManualEntryModal.tsx',
    'src/components/time-tracker/components/timesheets/TimesheetEntryDetail.tsx',
];

test('no project or worker list is a plain Select on the timesheet screens', () => {
    for (const p of SCREENS) {
        const s = readFileSync(p, 'utf8');
        assert.doesNotMatch(s, /<SelectItem key=\{(p|w|emp|project|worker)\.id\}/, p);
        assert.match(s, /<SearchableSelect/, p);
    }
});

test('the filter bar picks workers and projects with search, "all" being the empty choice', () => {
    const s = readFileSync(SCREENS[0], 'utf8');
    assert.match(s, /options=\{\[\{ value: '', label: t\('allWorkers'\) \}/);
    assert.match(s, /options=\{\[\{ value: '', label: t\('allProjects'\) \}/);
});
