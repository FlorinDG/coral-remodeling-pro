/**
 * CHARACTERIZATION — R2-5 Write Path: the guards every write door runs (REAL code).
 *
 * The OCC / field-merge cases that lived here exercised a COPY of the inline merge loop, so they
 * could not detect a change in the real code. That logic now lives in ONE function
 * (src/lib/records/occ-merge.ts) and is tested for real in tests/occ-merge.test.ts and
 * tests/occ-merge-store.test.ts (OCC-MERGE-1, Planner 2026-10-02).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkExportLock, isWipeHazard } from '../src/lib/records/export-lock.ts';

describe('write-door guards', () => {
    test('saveGlobalPage export-lock: checkExportLock blocks write with EXPORT_LOCKED and blockedFields', () => {
        const lockedProperties = {
            title: 'Factuur 2026-001',
            status: 'sent',
            peppolStatus: 'delivered',
            totalExVat: 1000,
            accountantExportedAt: true,
        };
        const modifiedProperties = {
            ...lockedProperties,
            totalExVat: 1500, // modifying financial total after export
        };

        const violation = checkExportLock(lockedProperties, modifiedProperties, new Set(), undefined, undefined);
        assert.ok(violation);
        assert.ok(violation.blockedFields.includes('totalExVat'));
    });

    test('saveGlobalPage wipe-hazard: isWipeHazard blocks empty blocks array overwriting populated blocks', () => {
        const existingBlocks = [{ id: 'b1', type: 'paragraph', content: 'Billable task line 1' }];
        const emptyIncomingBlocks: any[] = [];

        assert.equal(isWipeHazard(existingBlocks, emptyIncomingBlocks), true);
        assert.equal(isWipeHazard([], emptyIncomingBlocks), false);
        assert.equal(isWipeHazard(existingBlocks, [{ id: 'b2', type: 'paragraph', content: 'Replacement line' }]), false);
    });

});
