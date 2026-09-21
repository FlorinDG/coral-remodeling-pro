import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRelationTarget, resolveRelationTitle } from '../src/lib/relations/resolve.ts';
import type { Database, PageIndexEntry } from '../src/components/admin/database/types.ts';

test('resolveRelationTarget — PANEL-1 contract invariants', async (t) => {
    await t.test('resolves logical key to tenant scoped ID through lockedDbIds', () => {
        const lockedDbIds = {
            clients: 'db-clients-tenant123',
            suppliers: 'db-suppliers-tenant123'
        };

        const res = resolveRelationTarget('db-clients', {
            lockedDbIds,
            loadedDatabaseIds: ['db-clients-tenant123'],
            databases: [{
                id: 'db-clients-tenant123',
                name: 'Clients',
                properties: [],
                pages: [],
                views: [],
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                lastEditedBy: ''
            }]
        });

        assert.equal(res.databaseId, 'db-clients-tenant123');
        assert.equal(res.status, 'ready');
        assert.deepEqual(res.options, []);
    });

    await t.test('falls back to pageIndex when database is not loaded in memory', () => {
        const pageIndex: Record<string, PageIndexEntry> = {
            'client-1': {
                id: 'client-1',
                databaseId: 'db-clients-tenant123',
                title: 'Acme Corp',
                updatedAt: '2026-09-01T00:00:00.000Z'
            },
            'client-2': {
                id: 'client-2',
                databaseId: 'db-clients-tenant123',
                title: 'Globex Inc',
                updatedAt: '2026-09-02T00:00:00.000Z'
            }
        };

        const lockedDbIds = {
            clients: 'db-clients-tenant123'
        };

        // Note: 'db-clients-tenant123' is NOT in loadedDatabaseIds, targetDatabase has no pages
        const res = resolveRelationTarget('db-clients', {
            lockedDbIds,
            pageIndex,
            loadedDatabaseIds: [],
            databases: []
        });

        assert.equal(res.databaseId, 'db-clients-tenant123');
        assert.equal(res.status, 'ready');
        assert.equal(res.options.length, 2);
        assert.equal(res.options[0].id, 'client-1');
        assert.equal(res.options[0].title, 'Acme Corp');
        assert.equal(res.options[1].id, 'client-2');
        assert.equal(res.options[1].title, 'Globex Inc');
    });

    await t.test('returns status: not-loaded when database is known but not loaded and has no pageIndex entries', () => {
        const lockedDbIds = {
            clients: 'db-clients-tenant123'
        };

        const res = resolveRelationTarget('db-clients', {
            lockedDbIds,
            pageIndex: {},
            loadedDatabaseIds: [],
            databases: []
        });

        assert.equal(res.databaseId, 'db-clients-tenant123');
        assert.equal(res.status, 'not-loaded');
        assert.deepEqual(res.options, []);
    });

    await t.test('returns status: unknown-database for non-existent target database', () => {
        const res = resolveRelationTarget('db-does-not-exist', {
            lockedDbIds: {},
            pageIndex: {},
            loadedDatabaseIds: [],
            databases: []
        });

        assert.equal(res.status, 'unknown-database');
        assert.deepEqual(res.options, []);
    });

    await t.test('preserves and resolves already-scoped IDs directly', () => {
        const pageIndex: Record<string, PageIndexEntry> = {
            'supplier-1': {
                id: 'supplier-1',
                databaseId: 'db-suppliers-xyz999',
                title: 'Build Supplies BV',
                updatedAt: '2026-09-01T00:00:00.000Z'
            }
        };

        const res = resolveRelationTarget('db-suppliers-xyz999', {
            pageIndex,
            loadedDatabaseIds: ['db-suppliers-xyz999'],
            databases: []
        });

        assert.equal(res.databaseId, 'db-suppliers-xyz999');
        assert.equal(res.status, 'ready');
        assert.equal(res.options.length, 1);
        assert.equal(res.options[0].title, 'Build Supplies BV');
    });

    await t.test('handles custom databases by ID', () => {
        const customDbId = 'db-custom-inspections-456';
        const databases: Database[] = [{
            id: customDbId,
            name: 'Inspections',
            properties: [],
            pages: [
                {
                    id: 'insp-1',
                    databaseId: customDbId,
                    order: 0,
                    properties: { title: 'Site Inspection A' },
                    blocks: [],
                    blocksVersion: 1,
                    createdAt: '',
                    updatedAt: '',
                    createdBy: '',
                    lastEditedBy: ''
                }
            ],
            views: [],
            createdAt: '',
            updatedAt: '',
            createdBy: '',
            lastEditedBy: ''
        }];

        const res = resolveRelationTarget(customDbId, {
            databases,
            loadedDatabaseIds: [customDbId]
        });

        assert.equal(res.databaseId, customDbId);
        assert.equal(res.status, 'ready');
        assert.equal(res.options.length, 1);
        assert.equal(res.options[0].title, 'Site Inspection A');
    });
});

test('resolveRelationTitle — priority order', async (t) => {
    const pageIndex: Record<string, PageIndexEntry> = {
        'page-123': {
            id: 'page-123',
            databaseId: 'db-clients',
            title: 'From Page Index',
            updatedAt: ''
        }
    };

    const targetDatabase: Database = {
        id: 'db-clients',
        name: 'Clients',
        properties: [],
        pages: [
            {
                id: 'page-123',
                databaseId: 'db-clients',
                order: 0,
                properties: { title: 'From Target Database' },
                blocks: [],
                blocksVersion: 1,
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                lastEditedBy: ''
            },
            {
                id: 'page-456',
                databaseId: 'db-clients',
                order: 1,
                properties: { title: 'From Target Only' },
                blocks: [],
                blocksVersion: 1,
                createdAt: '',
                updatedAt: '',
                createdBy: '',
                lastEditedBy: ''
            }
        ],
        views: [],
        createdAt: '',
        updatedAt: '',
        createdBy: '',
        lastEditedBy: ''
    };

    await t.test('prefers pageIndex title for O(1) instant display', () => {
        const title = resolveRelationTitle('page-123', { pageIndex, targetDatabase });
        assert.equal(title, 'From Page Index');
    });

    await t.test('falls back to targetDatabase if pageIndex does not have record', () => {
        const title = resolveRelationTitle('page-456', { pageIndex, targetDatabase });
        assert.equal(title, 'From Target Only');
    });

    await t.test('returns null for missing record', () => {
        const title = resolveRelationTitle('non-existent', { pageIndex, targetDatabase });
        assert.equal(title, null);
    });
});
