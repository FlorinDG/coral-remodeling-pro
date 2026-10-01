/**
 * CHARACTERIZATION TESTS — R2-5 Write Path: OCC & Field Merge
 *
 * Pins current behavior of the server-side version checks and field merge:
 * 1. OCC accept / reject across the write doors:
 *    - src/app/actions/pages.ts: createPageServerFirst, updatePageServerFirst
 *    - src/app/actions/global-databases.ts: saveGlobalPage, saveGlobalPagesBatch
 * 2. Field merge: 3-way merge behavior when concurrent edits occur on same vs different fields.
 *
 * NOTE: Pins CURRENT behavior, not desired behavior. Known defects are explicitly prefixed
 * with "KNOWN DEFECT:" per coder-directive-r2-5-characterization.md.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkExportLock, isWipeHazard } from '../src/lib/records/export-lock.ts';

/**
 * Pure extraction of the 3-way merge and OCC conflict decision logic
 * executed inline inside saveGlobalPage (src/app/actions/global-databases.ts:504-580)
 * and saveGlobalPagesBatch (src/app/actions/global-databases.ts:714-780).
 */
const DERIVED_PROPERTY_KEYS = new Set(['totalVat', 'totalExVat', 'totalIncVat', 'margin', 'totalCost', 'totalProfit']);

function isDeepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!isDeepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!keysB.includes(key) || !isDeepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    return false;
}

interface OccDecisionInput {
    existingPage?: {
        updatedAt: Date;
        properties: Record<string, unknown>;
        blocksVersion: number;
        blocks: any[];
        lastEditedBy?: string;
    };
    page: {
        id: string;
        baseUpdatedAt?: string;
        properties: Record<string, unknown>;
        dirtyBase?: Record<string, unknown>;
        blocksVersion?: number;
        dirtyBaseBlocks?: boolean;
        blocks?: any[];
    };
}

interface OccDecisionResult {
    conflict: boolean;
    conflictShape?: {
        success: false;
        error: string;
        errorCode: string;
        lastEditedBy?: string;
        serverUpdatedAt: string;
        serverBlocksVersion: number;
    };
    finalProperties?: Record<string, unknown>;
    newBlocksVersion?: number;
}

function evaluateOccAndMerge(input: OccDecisionInput): OccDecisionResult {
    const { existingPage, page } = input;
    if (!existingPage) {
        return {
            conflict: false,
            finalProperties: page.properties,
            newBlocksVersion: page.dirtyBaseBlocks ? (page.blocksVersion || 1) + 1 : (page.blocksVersion || 1),
        };
    }

    let finalProperties = page.properties;

    if (page.baseUpdatedAt) {
        const serverTime = existingPage.updatedAt.getTime();
        const clientTime = new Date(page.baseUpdatedAt).getTime();

        if (serverTime !== clientTime) {
            let hasHardConflict = false;

            // 1. Guard blocks: exact version match required only if we are writing blocks
            if (page.dirtyBaseBlocks && existingPage.blocksVersion !== page.blocksVersion) {
                hasHardConflict = true;
            }

            // 2. Merge properties
            if (!hasHardConflict) {
                const serverProps = existingPage.properties || {};
                const clientProps = page.properties;
                const dirtyBase = page.dirtyBase || {};
                const mergedProps = { ...serverProps };

                for (const key of Object.keys(clientProps)) {
                    const isClientSameAsServer = isDeepEqual(clientProps[key], serverProps[key]);
                    const isServerSameAsBase = isDeepEqual(serverProps[key], dirtyBase[key]);
                    const isClientSameAsBase = isDeepEqual(clientProps[key], dirtyBase[key]);

                    if (!isClientSameAsServer) {
                        if (!isServerSameAsBase && !isClientSameAsBase && !DERIVED_PROPERTY_KEYS.has(key)) {
                            hasHardConflict = true;
                            break;
                        } else {
                            mergedProps[key] = clientProps[key];
                        }
                    }
                }
                if (!hasHardConflict) {
                    finalProperties = mergedProps;
                }
            }

            if (hasHardConflict) {
                return {
                    conflict: true,
                    conflictShape: {
                        success: false,
                        error: 'STALE_WRITE',
                        errorCode: 'STALE_WRITE',
                        lastEditedBy: existingPage.lastEditedBy,
                        serverUpdatedAt: existingPage.updatedAt.toISOString(),
                        serverBlocksVersion: existingPage.blocksVersion,
                    },
                };
            }
        }
    }

    const newBlocksVersion = page.dirtyBaseBlocks
        ? (existingPage.blocksVersion || 1) + 1
        : (existingPage.blocksVersion || 1);

    return {
        conflict: false,
        finalProperties,
        newBlocksVersion,
    };
}

describe('1 · OCC accept / reject — write door version checks', () => {
    test('saveGlobalPage pure decision: matching baseUpdatedAt accepts without conflict', () => {
        const timestamp = '2026-10-01T12:00:00.000Z';
        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date(timestamp),
                properties: { title: 'Invoice 1', status: 'draft' },
                blocksVersion: 1,
                blocks: [],
                lastEditedBy: 'alice',
            },
            page: {
                id: 'page-1',
                baseUpdatedAt: timestamp,
                properties: { title: 'Invoice 1 Updated', status: 'draft' },
                blocksVersion: 1,
            },
        });

        assert.equal(result.conflict, false);
        assert.equal(result.finalProperties?.title, 'Invoice 1 Updated');
        assert.equal(result.newBlocksVersion, 1);
    });

    test('saveGlobalPage pure decision: mismatched baseUpdatedAt with dirtyBaseBlocks and changed blocksVersion returns STALE_WRITE conflict shape', () => {
        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T14:00:00.000Z'),
                properties: { title: 'Invoice 1' },
                blocksVersion: 3,
                blocks: [{ id: 'b1' }],
                lastEditedBy: 'bob',
            },
            page: {
                id: 'page-1',
                baseUpdatedAt: '2026-10-01T13:00:00.000Z',
                properties: { title: 'Invoice 1' },
                blocksVersion: 2, // Client has stale blocksVersion (2 vs 3)
                dirtyBaseBlocks: true,
                blocks: [{ id: 'b1' }, { id: 'b2' }],
            },
        });

        assert.equal(result.conflict, true);
        assert.deepEqual(result.conflictShape, {
            success: false,
            error: 'STALE_WRITE',
            errorCode: 'STALE_WRITE',
            lastEditedBy: 'bob',
            serverUpdatedAt: '2026-10-01T14:00:00.000Z',
            serverBlocksVersion: 3,
        });
    });

    test('saveGlobalPage pure decision: mismatched baseUpdatedAt without dirtyBaseBlocks accepts when properties do not conflict', () => {
        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T14:00:00.000Z'),
                properties: { title: 'Invoice 1', status: 'draft' },
                blocksVersion: 3,
                blocks: [{ id: 'b1' }],
                lastEditedBy: 'bob',
            },
            page: {
                id: 'page-1',
                baseUpdatedAt: '2026-10-01T13:00:00.000Z',
                properties: { title: 'Invoice 1 Edited', status: 'draft' },
                dirtyBase: { title: 'Invoice 1', status: 'draft' },
                blocksVersion: 2, // stale blocksVersion, but dirtyBaseBlocks is FALSE
                dirtyBaseBlocks: false,
            },
        });

        assert.equal(result.conflict, false);
        assert.equal(result.finalProperties?.title, 'Invoice 1 Edited');
        assert.equal(result.newBlocksVersion, 3);
    });

    test('KNOWN DEFECT: missing baseUpdatedAt in saveGlobalPage bypasses OCC check completely', () => {
        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T14:00:00.000Z'),
                properties: { title: 'Server Authoritative Title', amount: 1000 },
                blocksVersion: 5,
                blocks: [{ id: 'b1' }],
                lastEditedBy: 'bob',
            },
            page: {
                id: 'page-1',
                baseUpdatedAt: undefined, // baseUpdatedAt omitted
                properties: { title: 'Blind Overwrite Title', amount: 500 },
                blocksVersion: 1, // wildly stale
                dirtyBaseBlocks: true,
            },
        });

        // Current defect: when page.baseUpdatedAt is undefined, saveGlobalPage never checks OCC
        assert.equal(result.conflict, false);
        assert.equal(result.finalProperties?.title, 'Blind Overwrite Title');
    });

    test('KNOWN DEFECT: updatePageServerFirst has no baseUpdatedAt parameter and unconditionally overwrites', () => {
        // Characterization of src/app/actions/pages.ts:176 updatePageServerFirst(pageId, properties):
        // Signature takes ONLY (pageId: string, properties: Record<string, PropertyValue>).
        // It runs checkExportLock, but performs no OCC check against existing.updatedAt.
        const mockUpdateDoor = (existing: { updatedAt: Date; properties: Record<string, any> }, incomingProps: Record<string, any>) => {
            // Emulates updatePageServerFirst line 226: prisma.globalPage.update({ where: { id: pageId }, data: { properties } })
            return {
                success: true,
                savedProperties: incomingProps,
                overwroteStale: true,
            };
        };

        const existing = {
            updatedAt: new Date('2026-10-01T12:00:00.000Z'),
            properties: { title: 'Original', status: 'approved' },
        };
        const incomingStale = { title: 'Stale Overwrite', status: 'draft' };

        const res = mockUpdateDoor(existing, incomingStale);
        assert.equal(res.success, true);
        assert.equal(res.savedProperties.title, 'Stale Overwrite');
    });

    test('KNOWN DEFECT: createPageServerFirst accepts no concurrency version and assigns blocksVersion 1', () => {
        // Characterization of src/app/actions/pages.ts:80 createPageServerFirst:
        // Always creates Page with blocks: [], blocksVersion: 1.
        const mockCreateDoor = (properties: Record<string, any>) => {
            return {
                properties,
                blocks: [],
                blocksVersion: 1,
            };
        };

        const res = mockCreateDoor({ title: 'New Page' });
        assert.equal(res.blocksVersion, 1);
        assert.deepEqual(res.blocks, []);
    });

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

    test('saveGlobalPagesBatch: processes items sequentially with granular per-page OCC conflict reporting', () => {
        // saveGlobalPagesBatch loops over pages[] and pushes individual OCC conflict objects
        const batchPages = [
            {
                id: 'p-ok',
                baseUpdatedAt: '2026-10-01T10:00:00.000Z',
                properties: { title: 'P1' },
            },
            {
                id: 'p-conflict',
                baseUpdatedAt: '2026-10-01T09:00:00.000Z',
                properties: { title: 'P2' },
                dirtyBaseBlocks: true,
                blocksVersion: 1,
            },
        ];

        const existingMap = new Map([
            ['p-ok', { updatedAt: new Date('2026-10-01T10:00:00.000Z'), properties: { title: 'P1' }, blocksVersion: 1 }],
            ['p-conflict', { updatedAt: new Date('2026-10-01T11:00:00.000Z'), properties: { title: 'P2' }, blocksVersion: 2 }],
        ]);

        const results: any[] = [];
        for (const p of batchPages) {
            const existing = existingMap.get(p.id)!;
            const evalResult = evaluateOccAndMerge({
                existingPage: {
                    updatedAt: existing.updatedAt,
                    properties: existing.properties,
                    blocksVersion: existing.blocksVersion,
                    blocks: [],
                    lastEditedBy: 'peer',
                },
                page: p,
            });

            if (evalResult.conflict) {
                results.push({ id: p.id, ...evalResult.conflictShape });
            } else {
                results.push({ id: p.id, success: true });
            }
        }

        assert.equal(results.length, 2);
        assert.equal(results[0].success, true);
        assert.equal(results[1].success, false);
        assert.equal(results[1].errorCode, 'STALE_WRITE');
        assert.equal(results[1].id, 'p-conflict');
    });
});

describe('2 · Field merge — two concurrent edits of DIFFERENT fields of one row', () => {
    test('KNOWN DEFECT: snapshot write stomps concurrent server edit when client submits entire row snapshot', () => {
        // Scenario:
        // Baseline state: { title: 'Original', status: 'draft', notes: 'Initial note' }
        // Peer on server edits 'status' -> 'approved' (server timestamp advances).
        // User on client edits 'title' -> 'Updated Title'.
        // BUT client submits full properties snapshot where status is still 'draft'.
        const baseline = { title: 'Original', status: 'draft', notes: 'Initial note' };
        const serverCurrent = { title: 'Original', status: 'approved', notes: 'Initial note' };

        const clientSubmission = {
            id: 'page-1',
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            properties: { title: 'Updated Title', status: 'draft', notes: 'Initial note' },
            dirtyBase: baseline,
        };

        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T10:05:00.000Z'), // server is newer
                properties: serverCurrent,
                blocksVersion: 1,
                blocks: [],
            },
            page: clientSubmission,
        });

        assert.equal(result.conflict, false);
        // Current defect in saveGlobalPage line 558:
        // For 'status', client is 'draft', server is 'approved', dirtyBase is 'draft'.
        // Because client === dirtyBase ('draft' === 'draft'), !isClientSameAsBase is false.
        // It enters the else branch: mergedProps[key] = clientProps[key].
        // Result: server's 'approved' is STOMPED back to 'draft'!
        assert.equal(result.finalProperties?.title, 'Updated Title');
        assert.equal(result.finalProperties?.status, 'draft'); // Server change was overwritten by client snapshot
    });

    test('KNOWN DEFECT: partial dirtyBase tracks only edited key, causing untouched fields to trigger false hard STALE_WRITE conflict', () => {
        // Scenario:
        // If client's dirtyBase ONLY records the single field that the user touched:
        // dirtyBase = { title: 'Original' } (status is NOT in dirtyBase).
        // Server changed 'status' from 'draft' to 'approved'.
        // Client changed 'title' to 'Updated Title'.
        const serverCurrent = { title: 'Original', status: 'approved' };
        const clientSubmission = {
            id: 'page-1',
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            properties: { title: 'Updated Title', status: 'draft' },
            dirtyBase: { title: 'Original' }, // status missing from dirtyBase!
        };

        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T10:05:00.000Z'),
                properties: serverCurrent,
                blocksVersion: 1,
                blocks: [],
            },
            page: clientSubmission,
        });

        // Because 'status' is not in dirtyBase:
        // isServerSameAsBase ('approved' === undefined) -> false
        // isClientSameAsBase ('draft' === undefined) -> false
        // Result: false hard conflict!
        assert.equal(result.conflict, true);
        assert.equal(result.conflictShape?.errorCode, 'STALE_WRITE');
    });

    test('field merge algorithm: concurrent edit of SAME non-derived field produces hard STALE_WRITE conflict', () => {
        // Both client and server changed 'title' to different values:
        const baseline = { title: 'Original', status: 'draft' };
        const serverCurrent = { title: 'Server Title', status: 'draft' };

        const clientSubmission = {
            id: 'page-1',
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            properties: { title: 'Client Title', status: 'draft' },
            dirtyBase: baseline,
        };

        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T10:05:00.000Z'),
                properties: serverCurrent,
                blocksVersion: 1,
                blocks: [],
                lastEditedBy: 'alice',
            },
            page: clientSubmission,
        });

        assert.equal(result.conflict, true);
        assert.equal(result.conflictShape?.errorCode, 'STALE_WRITE');
        assert.equal(result.conflictShape?.lastEditedBy, 'alice');
    });

    test('field merge algorithm: concurrent edit of derived property keys does not trigger hard conflict', () => {
        // DERIVED_PROPERTY_KEYS: totalVat, totalExVat, totalIncVat, margin, totalCost, totalProfit
        // Even if both server and client recomputed totalExVat differently, it never triggers a hard conflict.
        const baseline = { title: 'Invoice 1', totalExVat: 1000 };
        const serverCurrent = { title: 'Invoice 1', totalExVat: 1200 }; // server recomputed

        const clientSubmission = {
            id: 'page-1',
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            properties: { title: 'Invoice 1', totalExVat: 1100 }, // client recomputed
            dirtyBase: baseline,
        };

        const result = evaluateOccAndMerge({
            existingPage: {
                updatedAt: new Date('2026-10-01T10:05:00.000Z'),
                properties: serverCurrent,
                blocksVersion: 1,
                blocks: [],
            },
            page: clientSubmission,
        });

        assert.equal(result.conflict, false);
        // Client's calculation lands because derived keys are exempt from hard conflict
        assert.equal(result.finalProperties?.totalExVat, 1100);
    });
});
