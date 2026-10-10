/**
 * END-CLIENT-1 written once (core order-giver), and the timesheet's entry detail shows the shift's Details tab
 * (Florin 2026-10-10: "one thing is not there: the DETAILS field of the shift").
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orderGiverIdOf } from '../src/lib/records/order-giver.ts';

describe('END-CLIENT-1 · the order giver', () => {
    test('the shift\'s own client wins; else the project\'s client; else none', () => {
        assert.equal(orderGiverIdOf('c-shift', { 'prop-client': ['c-proj'] }), 'c-shift');
        assert.equal(orderGiverIdOf(null, { 'prop-client': ['c-proj'] }), 'c-proj');
        assert.equal(orderGiverIdOf('', { 'prop-client': 'c-proj' }), 'c-proj');
        assert.equal(orderGiverIdOf(null, { 'prop-client': [] }), null);
        assert.equal(orderGiverIdOf(null, null), null);
    });
    test('the werkbon and the timesheet\'s shift context both use the one rule', () => {
        for (const p of ['src/lib/data/werkbon.ts', 'src/lib/data/entry-shift-context.ts']) {
            const s = readFileSync(p, 'utf8');
            assert.match(s, /orderGiverIdOf\(/, p);
            assert.doesNotMatch(s, /\['prop-client'\]/, `${p} reads prop-client by hand`);
        }
    });
});

describe('Timesheets · the shift\'s Details in the entry detail', () => {
    const UI = readFileSync('src/components/time-tracker/components/timesheets/TimesheetEntryDetail.tsx', 'utf8');
    const CTX = readFileSync('src/lib/data/entry-shift-context.ts', 'utf8');
    test('the context carries the Details tab: project, order giver, role, address, materials', () => {
        assert.match(CTX, /details: \{\s*projectName:[\s\S]*orderGiver:[\s\S]*role:[\s\S]*siteAddress:[\s\S]*materialsEnabled:/);
    });
    test('the detail renders it with the editor\'s labels, and says when an entry has no shift', () => {
        assert.match(UI, /tShift\('create\.tabDetails'\)/);
        assert.match(UI, /tShift\('create\.notesLabel'\)/);
        assert.match(UI, /tShift\('create\.orderGiver'\)/);
        assert.match(UI, /\{t\('notLinkedToShift'\)\}/);
    });
});
