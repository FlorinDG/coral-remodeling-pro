/**
 * HR-SERAPH-1 · HR READ SIDE & TIMESHEETS ONTO SCOPED CLIENT (CONTRACT TEST)
 *
 * Pins the EXACT query shapes run by the 10 migrated HR files per Planner Review (B5):
 * 1. ClockEntry `findFirst` by id (timesheet-rates/route.ts:44)
 * 2. User `findMany` id-in (leave/page.tsx:22, hr-announcements.ts:33)
 * 3. Employee `findMany` userId-in (leave/page.tsx:26, timesheet-export/route.tsx:100)
 * 4. RateChangeAudit `update` by id (timesheet-rates/undo/route.ts:57)
 * 5. HrTeamMember `findMany` via team (team-scoping.ts:10, 22)
 * 6. HrDocumentAcknowledgment upsert (hr-documents.ts:55)
 * 7. HrAnnouncementRead upsert (hr-announcements.ts:62)
 * 8. B1 tenant mismatch throw in team-scoping.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scopeArgs, TenantMismatchError } from '../src/lib/data/scope-args.ts';
import { getAccessibleUserIds } from '../src/app/api/hr/lib/team-scoping.ts';

const T_SESSION = 'tenant-coral-prod';
const T_FOREIGN = 'tenant-adversary';

describe('HR-SERAPH-1 · Exact Query Shape Pins & Throw Proofs (B5)', () => {
    // 1. ClockEntry findFirst by id (timesheet-rates/route.ts:44)
    test('1 · timesheet-rates/route.ts:44 — ClockEntry findFirst by id carries session tenant', () => {
        const { args } = scopeArgs('ClockEntry', 'findFirst', { where: { id: 'entry-999' } }, T_SESSION);
        assert.deepEqual(args.where, { id: 'entry-999', tenantId: T_SESSION });

        // Throw proof: caller cannot override tenantId to foreign tenant
        const hijacked = scopeArgs('ClockEntry', 'findFirst', { where: { id: 'entry-999', tenantId: T_FOREIGN } }, T_SESSION);
        assert.equal((hijacked.args.where as any).tenantId, T_SESSION);
    });

    // 2. User findMany id-in (leave/page.tsx:22, hr-announcements.ts:33)
    test('2 · leave/page.tsx:22 & hr-announcements.ts:33 — User findMany id-in scoped to session tenant', () => {
        const userIds = ['user-1', 'user-2', 'user-foreign'];
        const { args } = scopeArgs('User', 'findMany', { where: { id: { in: userIds } }, select: { id: true, name: true } }, T_SESSION);
        assert.deepEqual(args.where, { id: { in: userIds }, tenantId: T_SESSION });

        // Throw proof: anti-hijacking prevents foreign tenant widening
        const hijacked = scopeArgs('User', 'findMany', { where: { id: { in: userIds }, tenantId: T_FOREIGN } }, T_SESSION);
        assert.equal((hijacked.args.where as any).tenantId, T_SESSION);
    });

    // 3. Employee findMany userId-in (leave/page.tsx:26, timesheet-export/route.tsx:100)
    test('3 · leave/page.tsx:26 & timesheet-export:100 — Employee findMany userId-in scoped to session tenant', () => {
        const userIds = ['user-1', 'user-2'];
        const { args } = scopeArgs('Employee', 'findMany', { where: { userId: { in: userIds } } }, T_SESSION);
        assert.deepEqual(args.where, { userId: { in: userIds }, tenantId: T_SESSION });
    });

    // 4. RateChangeAudit update by id (timesheet-rates/undo/route.ts:57)
    test('4 · timesheet-rates/undo/route.ts:57 — RateChangeAudit update by id scoped, cross-tenant update throws', () => {
        const now = new Date();
        const { args } = scopeArgs('RateChangeAudit', 'update', { where: { id: 'audit-123' }, data: { revertedAt: now } }, T_SESSION);
        assert.deepEqual(args.where, { id: 'audit-123', tenantId: T_SESSION });

        // Throw proof: attempt to update row into foreign tenant throws TenantMismatchError
        assert.throws(
            () => scopeArgs('RateChangeAudit', 'update', { where: { id: 'audit-123' }, data: { tenantId: T_FOREIGN } }, T_SESSION),
            TenantMismatchError
        );
    });

    // 5. HrTeamMember findMany via team (team-scoping.ts:10, 22)
    test('5 · team-scoping.ts:10, 22 — HrTeamMember findMany scopes via { team: { tenantId } }', () => {
        const { args: leadArgs } = scopeArgs('HrTeamMember', 'findMany', { where: { userId: 'u1', role: 'lead' } }, T_SESSION);
        assert.deepEqual(leadArgs.where, { userId: 'u1', role: 'lead', team: { tenantId: T_SESSION } });

        const { args: memArgs } = scopeArgs('HrTeamMember', 'findMany', { where: { teamId: { in: ['t1', 't2'] } } }, T_SESSION);
        assert.deepEqual(memArgs.where, { teamId: { in: ['t1', 't2'] }, team: { tenantId: T_SESSION } });
    });

    // 6. HrDocumentAcknowledgment upsert (hr-documents.ts:55)
    test('6 · hr-documents.ts:55 — HrDocumentAcknowledgment upsert scopes where and verifies parent HrDocument', () => {
        const now = new Date();
        const r = scopeArgs(
            'HrDocumentAcknowledgment',
            'upsert',
            {
                where: { userId_documentId: { userId: 'u1', documentId: 'doc-alpha' } },
                create: { userId: 'u1', documentId: 'doc-alpha', signatureData: 'sig', readAt: now },
                update: { signatureData: 'sig', readAt: now }
            },
            T_SESSION
        );

        // Where is scoped transitively via parent document
        assert.deepEqual(r.args.where, {
            userId_documentId: { userId: 'u1', documentId: 'doc-alpha' },
            document: { tenantId: T_SESSION }
        });
        // Parent verification returned
        assert.deepEqual(r.verifyParents, [{ parent: 'HrDocument', id: 'doc-alpha' }]);

        // Throw proof: create without parent documentId throws TenantMismatchError
        assert.throws(
            () => scopeArgs('HrDocumentAcknowledgment', 'upsert', {
                where: { userId_documentId: { userId: 'u1', documentId: 'doc-alpha' } },
                create: { userId: 'u1', signatureData: 'sig' },
                update: { signatureData: 'sig' }
            }, T_SESSION),
            TenantMismatchError
        );
    });

    // 7. HrAnnouncementRead upsert (hr-announcements.ts:62)
    test('7 · hr-announcements.ts:62 — HrAnnouncementRead upsert scopes where and verifies parent HrAnnouncement', () => {
        const now = new Date();
        const r = scopeArgs(
            'HrAnnouncementRead',
            'upsert',
            {
                where: { userId_announcementId: { userId: 'u1', announcementId: 'ann-alpha' } },
                create: { userId: 'u1', announcementId: 'ann-alpha', readAt: now },
                update: { readAt: now }
            },
            T_SESSION
        );

        assert.deepEqual(r.args.where, {
            userId_announcementId: { userId: 'u1', announcementId: 'ann-alpha' },
            announcement: { tenantId: T_SESSION }
        });
        assert.deepEqual(r.verifyParents, [{ parent: 'HrAnnouncement', id: 'ann-alpha' }]);

        // Throw proof: create without parent announcementId throws TenantMismatchError
        assert.throws(
            () => scopeArgs('HrAnnouncementRead', 'upsert', {
                where: { userId_announcementId: { userId: 'u1', announcementId: 'ann-alpha' } },
                create: { userId: 'u1' },
                update: {}
            }, T_SESSION),
            TenantMismatchError
        );
    });

    // 8. B1 mismatch throw in team-scoping.ts
    test('8 · team-scoping.ts B1 — tenantId mismatch between param and session throws TenantMismatchError', async () => {
        const mockAuth = async () => ({
            user: { id: 'u1', tenantId: T_SESSION }
        } as any);

        await assert.rejects(
            async () => {
                await getAccessibleUserIds(T_FOREIGN, 'u1', mockAuth);
            },
            TenantMismatchError,
            'Must throw TenantMismatchError when tenantId param does not match session tenant'
        );

        // Throw proof: session without tenant throws
        await assert.rejects(
            async () => {
                await getAccessibleUserIds(T_SESSION, 'u1', async () => null);
            },
            /no tenant in session/,
            'Must throw when session has no tenant'
        );
    });

    // 9. B8 undo rate grouping covers every entry once (timesheet-rates/undo/route.ts)
    test('9 · timesheet-rates/undo B8 — groupSnapshotByRate groups by oldRate covering every entry exactly once', async () => {
        const { groupSnapshotByRate } = await import('../src/lib/records/rate-snapshot.ts');

        const snapshot = [
            { entryId: 'e1', oldRate: 35 },
            { entryId: 'e2', oldRate: 35 },
            { entryId: 'e3', oldRate: 40 },
            { entryId: 'e4', oldRate: null },
            { entryId: 'e5', oldRate: 0 },
            { entryId: 'e6', oldRate: 40 },
            { entryId: 'e7', oldRate: null },
        ];

        const grouped = groupSnapshotByRate(snapshot);

        // Group counts
        assert.equal(grouped.size, 4, '4 distinct rate groups expected (35, 40, null, 0)');
        assert.deepEqual(grouped.get(35), ['e1', 'e2']);
        assert.deepEqual(grouped.get(40), ['e3', 'e6']);
        assert.deepEqual(grouped.get(null), ['e4', 'e7']);
        assert.deepEqual(grouped.get(0), ['e5']);

        // Invariant: every entry appears exactly once
        function assertSnapshotCoveredExactlyOnce(
            orig: typeof snapshot,
            res: Map<number | null, string[]>
        ) {
            const seen = new Set<string>();
            let count = 0;
            for (const ids of res.values()) {
                for (const id of ids) {
                    if (seen.has(id)) throw new Error(`duplicate entryId: ${id}`);
                    seen.add(id);
                    count++;
                }
            }
            if (count !== orig.length) {
                throw new Error(`count mismatch: expected ${orig.length}, got ${count}`);
            }
            for (const item of orig) {
                if (!seen.has(item.entryId)) throw new Error(`missing entryId: ${item.entryId}`);
            }
        }

        // Verified on actual grouped output
        assertSnapshotCoveredExactlyOnce(snapshot, grouped);

        // Throw proof 1: dropped entry triggers failure
        assert.throws(() => {
            const missingOne = new Map(grouped);
            missingOne.set(35, ['e1']); // dropped e2
            assertSnapshotCoveredExactlyOnce(snapshot, missingOne);
        }, /count mismatch/);

        // Throw proof 2: duplicated entry triggers failure
        assert.throws(() => {
            const dupedOne = new Map(grouped);
            dupedOne.set(35, ['e1', 'e2', 'e3']); // e3 duplicated from group 40
            assertSnapshotCoveredExactlyOnce(snapshot, dupedOne);
        }, /duplicate entryId: e3/);
    });
});

