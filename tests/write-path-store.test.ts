/**
 * CHARACTERIZATION TESTS — R2-5 Write Path: Store Invariants
 *
 * Pins current behavior of the client-side database store (src/components/admin/database/store.ts):
 * 3. Single-flight: loadDatabasePages deduplication via inFlightPageLoads
 * 4. Sync queue retry / backoff: retry thresholds, state transitions, backoff calculation, dequeue
 * 5. Dirty pages are never evicted: hydrateDatabases & loadDatabasePages preserve syncQueue pages (OCC-13)
 * 6. partialize: IndexedDB persistence filtering of clean pages and selective block stripping
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { useDatabaseStore } from '../src/components/admin/database/store.ts';
import {
    setMockGetDatabasePages,
    setMockSaveGlobalPage,
    setMockGetDatabaseVersion,
} from './stubs/global-databases.ts';

// Helper to reset store to pristine initial state between tests
function resetStoreState() {
    useDatabaseStore.setState({
        databases: [],
        pageIndex: {},
        loadedDatabaseIds: [],
        loadingDatabaseIds: [],
        syncStatus: 'idle',
        pendingSyncs: 0,
        syncQueue: [],
        isProcessingQueue: false,
        sessionTenantId: 'tenant-test',
        sessionUserId: 'user-test',
        undoStack: [],
        ungatedSchemas: [],
        _hasHydrated: true,
    });
}

describe('3 · Single-flight — inFlightPageLoads deduplication', () => {
    beforeEach(() => {
        resetStoreState();
    });

    test('loadDatabasePages deduplicates concurrent calls for the same database into a single in-flight fetch', async () => {
        let fetchCalls = 0;
        let resolveServerFetch!: (pages: any[]) => void;

        setMockGetDatabasePages(async (dbId: string) => {
            fetchCalls++;
            return new Promise(resolve => {
                resolveServerFetch = resolve;
            });
        });

        useDatabaseStore.setState({
            databases: [{ id: 'db-orders', name: 'Orders', pages: [] as any[] }],
            loadedDatabaseIds: [],
        });

        // Trigger two concurrent loadDatabasePages calls for 'db-orders'
        const load1 = useDatabaseStore.getState().loadDatabasePages('db-orders');
        const load2 = useDatabaseStore.getState().loadDatabasePages('db-orders');

        // Verify only 1 fetch call was initiated while in flight
        assert.equal(fetchCalls, 1, 'Server fetch action must only be called once');

        // Resolve the in-flight server fetch
        const serverPages = [
            { id: 'page-1', databaseId: 'db-orders', properties: { title: 'Order 1' }, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' },
        ];
        resolveServerFetch(serverPages);

        const [res1, res2] = await Promise.all([load1, load2]);

        // Both calls must resolve to the identical merged page array
        assert.equal(fetchCalls, 1, 'Fetch count must remain 1 after completion');
        assert.equal(res1, res2, 'Both concurrent callers must receive the exact same array instance');
        assert.equal(res1.length, 1);
        assert.equal(res1[0].id, 'page-1');
    });

    test('loadDatabasePages returns cached in-memory pages immediately when database is already loaded', async () => {
        let fetchCalls = 0;
        setMockGetDatabasePages(async () => {
            fetchCalls++;
            return [];
        });

        const cachedPages = [
            { id: 'page-cached', databaseId: 'db-cached', properties: { title: 'Cached' }, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' },
        ];

        useDatabaseStore.setState({
            databases: [{ id: 'db-cached', name: 'Cached DB', pages: cachedPages as any[] }],
            loadedDatabaseIds: ['db-cached'],
        });

        const pages = await useDatabaseStore.getState().loadDatabasePages('db-cached');

        assert.equal(fetchCalls, 0, 'Must not call server when database is already loaded');
        assert.equal(pages, cachedPages, 'Must return in-memory pages reference');
    });

    test('loadDatabasePages cleans up inFlightPageLoads entry after resolution allowing subsequent fetches', async () => {
        let fetchCalls = 0;
        setMockGetDatabasePages(async () => {
            fetchCalls++;
            return [{ id: 'p1', databaseId: 'db-fresh', properties: {}, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' }];
        });

        useDatabaseStore.setState({
            databases: [{ id: 'db-fresh', name: 'Fresh DB', pages: [] as any[] }],
            loadedDatabaseIds: [],
        });

        // First load
        await useDatabaseStore.getState().loadDatabasePages('db-fresh');
        assert.equal(fetchCalls, 1);

        // Unset loadedDatabaseIds to force another load
        useDatabaseStore.setState({ loadedDatabaseIds: [] });

        // Second load after first has settled
        await useDatabaseStore.getState().loadDatabasePages('db-fresh');
        assert.equal(fetchCalls, 2, 'Subsequent load after completion must initiate a new fetch');
    });
});

describe('4 · Sync queue retry / backoff', () => {
    beforeEach(() => {
        resetStoreState();
    });

    test('syncQueue _enqueueSync does not duplicate entries for the same pageId', () => {
        const store = useDatabaseStore.getState();

        useDatabaseStore.setState({
            databases: [{
                id: 'db-1',
                name: 'DB',
                pages: [{ id: 'page-10', databaseId: 'db-1', properties: {}, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' }] as any[],
            }],
            syncQueue: [],
            pendingSyncs: 0,
        });

        store._enqueueSync('page-10', 'db-1');
        assert.equal(useDatabaseStore.getState().syncQueue.length, 1);
        assert.equal(useDatabaseStore.getState().pendingSyncs, 1);

        // Enqueue same pageId again
        store._enqueueSync('page-10', 'db-1');
        assert.equal(useDatabaseStore.getState().syncQueue.length, 1, 'Must not add duplicate queue item');
    });

    test('_incrementRetry increments retryCount and transitions syncStatus from retrying to error at 5', () => {
        const store = useDatabaseStore.getState();

        useDatabaseStore.setState({
            syncQueue: [{ pageId: 'page-retry', databaseId: 'db-1', retryCount: 0 }],
            syncStatus: 'saving',
        });

        // Retries 1 to 4 -> status: 'retrying'
        for (let i = 1; i <= 4; i++) {
            store._incrementRetry('page-retry');
            const entry = useDatabaseStore.getState().syncQueue.find(e => e.pageId === 'page-retry');
            assert.equal(entry?.retryCount, i);
            assert.equal(useDatabaseStore.getState().syncStatus, 'retrying');
        }

        // Retry 5 -> status: 'error' (give-up threshold)
        store._incrementRetry('page-retry');
        const entry5 = useDatabaseStore.getState().syncQueue.find(e => e.pageId === 'page-retry');
        assert.equal(entry5?.retryCount, 5);
        assert.equal(useDatabaseStore.getState().syncStatus, 'error');

        // Retry 6 -> remains status: 'error'
        store._incrementRetry('page-retry');
        const entry6 = useDatabaseStore.getState().syncQueue.find(e => e.pageId === 'page-retry');
        assert.equal(entry6?.retryCount, 6);
        assert.equal(useDatabaseStore.getState().syncStatus, 'error');
    });

    test('exponential backoff delay calculation drives _processSyncQueue real timer waits (3000 * 2^retryCount)', async () => {
        mock.timers.enable({ apis: ['setTimeout'] });
        try {
            let callCount = 0;
            setMockSaveGlobalPage(async () => {
                callCount++;
                return { success: false, error: 'Network failure' };
            });

            useDatabaseStore.setState({
                databases: [{
                    id: 'db-1',
                    name: 'DB',
                    pages: [{ id: 'p-backoff', databaseId: 'db-1', properties: {}, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' }] as any[],
                }],
                syncQueue: [{ pageId: 'p-backoff', databaseId: 'db-1', retryCount: 0 }],
                syncStatus: 'idle',
                isProcessingQueue: false,
            });

            const processPromise = useDatabaseStore.getState()._processSyncQueue();
            const flush = async () => {
                for (let i = 0; i < 10; i++) await Promise.resolve();
            };
            await flush();

            // Initial attempt 0 failed. _incrementRetry set retryCount = 1.
            // Timer wait in store.ts:614 is 3000 * Math.pow(2, 1) = 6000ms.
            assert.equal(callCount, 1, 'Initial attempt must execute immediately');

            // Advance 4000ms (at 2000ms base this would fire; at 3000ms base it must NOT fire)
            mock.timers.tick(4000);
            await flush();
            assert.equal(callCount, 1, 'At 4000ms into 6000ms wait, second attempt must not have fired');

            // Advance to 5999ms total (1999ms more)
            mock.timers.tick(1999);
            await flush();
            assert.equal(callCount, 1, 'At 5999ms into 6000ms wait, second attempt must still not have fired');

            // Advance 1ms to reach 6000ms
            mock.timers.tick(1);
            await flush();
            assert.equal(callCount, 2, 'At 6000ms, retry 1 must execute');

            // Attempt 1 failed. retryCount = 2. Wait is 3000 * Math.pow(2, 2) = 12000ms.
            mock.timers.tick(11999);
            await flush();
            assert.equal(callCount, 2, 'At 11999ms into 12000ms wait, retry 2 must not have fired');

            mock.timers.tick(1);
            await flush();
            assert.equal(callCount, 3, 'At 12000ms, retry 2 must execute');

            // Attempt 2 failed. retryCount = 3. Wait is 3000 * Math.pow(2, 3) = 24000ms.
            mock.timers.tick(24000);
            await flush();
            assert.equal(callCount, 4, 'At 24000ms, retry 3 must execute');

            // Attempt 3 failed. retryCount = 4. Wait is 3000 * Math.pow(2, 4) = 48000ms.
            mock.timers.tick(48000);
            await flush();
            assert.equal(callCount, 5, 'At 48000ms, retry 4 must execute');

            // Attempt 4 failed. retryCount = 5.
            // store.ts:614 waits 3000 * Math.pow(2, 5) = 96000ms before next iteration breaks on retryCount >= 5.
            mock.timers.tick(96000);
            await flush();
            await processPromise;
            assert.equal(useDatabaseStore.getState().syncStatus, 'error');
            assert.equal(useDatabaseStore.getState().isProcessingQueue, false);
        } finally {
            mock.timers.reset();
        }
    });

    test('_dequeueSync removes item from syncQueue and resets syncStatus to idle when queue is empty', () => {
        const store = useDatabaseStore.getState();

        useDatabaseStore.setState({
            syncQueue: [
                { pageId: 'page-1', databaseId: 'db-1', retryCount: 0 },
                { pageId: 'page-2', databaseId: 'db-1', retryCount: 0 },
            ],
            pendingSyncs: 2,
            syncStatus: 'saving',
        });

        // Dequeue first
        store._dequeueSync('page-1');
        assert.equal(useDatabaseStore.getState().syncQueue.length, 1);
        assert.equal(useDatabaseStore.getState().pendingSyncs, 1);
        assert.equal(useDatabaseStore.getState().syncStatus, 'saving');

        // Dequeue second -> queue empty
        store._dequeueSync('page-2');
        assert.equal(useDatabaseStore.getState().syncQueue.length, 0);
        assert.equal(useDatabaseStore.getState().pendingSyncs, 0);
        assert.equal(useDatabaseStore.getState().syncStatus, 'idle');
    });

    test('_processSyncQueue stops processing when entry.retryCount >= 5 with syncStatus error', async () => {
        let saveAttempts = 0;
        setMockSaveGlobalPage(async () => {
            saveAttempts++;
            return { success: true };
        });

        useDatabaseStore.setState({
            databases: [{
                id: 'db-1',
                name: 'DB',
                pages: [{ id: 'p-failed', databaseId: 'db-1', properties: {}, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' }] as any[],
            }],
            syncQueue: [{ pageId: 'p-failed', databaseId: 'db-1', retryCount: 5 }],
            syncStatus: 'retrying',
            isProcessingQueue: false,
        });

        await useDatabaseStore.getState()._processSyncQueue();

        assert.equal(saveAttempts, 0, 'Must not attempt to save entry with retryCount >= 5');
        assert.equal(useDatabaseStore.getState().syncStatus, 'error');
        assert.equal(useDatabaseStore.getState().isProcessingQueue, false);
    });

    test('_processSyncQueue permanent refusal on EXPORT_LOCKED: dequeues immediately without retry and reverts optimistic state', async () => {
        setMockSaveGlobalPage(async () => {
            return {
                success: false,
                errorCode: 'EXPORT_LOCKED',
                error: '[ExportLocked] Document is finalized',
                serverProperties: { title: 'Server Final Title', accountantExportedAt: true },
                serverUpdatedAt: '2026-10-01T12:00:00.000Z',
                serverBlocksVersion: 1,
            };
        });

        const optimisticPage = {
            id: 'p-locked',
            databaseId: 'db-1',
            properties: { title: 'Optimistic Edit' },
            blocks: [],
            blocksVersion: 1,
            dirtyBase: { title: 'Server Final Title' },
            dirtyBaseBlocks: false,
            updatedAt: '2026-10-01T12:05:00.000Z',
            baseUpdatedAt: '2026-10-01T12:00:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-1', name: 'DB', pages: [optimisticPage] as any[] }],
            syncQueue: [{ pageId: 'p-locked', databaseId: 'db-1', retryCount: 0 }],
            syncStatus: 'saving',
            isProcessingQueue: false,
        });

        await useDatabaseStore.getState()._processSyncQueue();

        // 1. Dequeued immediately — never retried
        assert.equal(useDatabaseStore.getState().syncQueue.length, 0);

        // 2. Reverted optimistic state to server baseline
        const pageAfter = useDatabaseStore.getState().databases[0].pages[0];
        assert.equal(pageAfter.properties.title, 'Server Final Title');
        // OCC-MERGE-1 (deliberate change): clean = NO base. A leftover `{}` base made the next edit keep
        // an empty base, and every later concurrent edit became a false conflict.
        assert.equal(pageAfter.dirtyBase, undefined);
        assert.equal(pageAfter.dirtyBaseBlocks, false);
    });

    test('_processSyncQueue permanent refusal on EMPTY_BLOCKS_PROTECTION: dequeues immediately without retry', async () => {
        setMockSaveGlobalPage(async () => {
            return {
                success: false,
                errorCode: 'EMPTY_BLOCKS_PROTECTION',
                error: 'Cannot wipe invoice blocks',
            };
        });

        useDatabaseStore.setState({
            databases: [{
                id: 'db-1',
                name: 'DB',
                pages: [{ id: 'p-empty', databaseId: 'db-1', properties: {}, blocks: [], updatedAt: '2026-10-01T10:00:00.000Z' }] as any[],
            }],
            syncQueue: [{ pageId: 'p-empty', databaseId: 'db-1', retryCount: 0 }],
            syncStatus: 'saving',
            isProcessingQueue: false,
        });

        await useDatabaseStore.getState()._processSyncQueue();

        // Dequeued immediately
        assert.equal(useDatabaseStore.getState().syncQueue.length, 0);
    });
});

describe('5 · Dirty pages are never evicted — OCC-13', () => {
    beforeEach(() => {
        resetStoreState();
    });

    test('hydrateDatabases retains local page properties and blocks for pages in syncQueue', () => {
        const localDirtyPage = {
            id: 'page-dirty-1',
            databaseId: 'db-1',
            properties: { title: 'Local Unsaved Title', notes: 'Offline work' },
            blocks: [{ id: 'b1', type: 'paragraph', content: 'Local unsaved block' }],
            blocksVersion: 2,
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            updatedAt: '2026-10-01T10:05:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-1', name: 'DB', pages: [localDirtyPage] as any[] }],
            syncQueue: [{ pageId: 'page-dirty-1', databaseId: 'db-1', retryCount: 0 }],
        });

        // Server hydration payload has different/stale title
        const serverPage = {
            id: 'page-dirty-1',
            databaseId: 'db-1',
            properties: { title: 'Server Stale Title', notes: 'Server notes' },
            blocks: [{ id: 'b1', type: 'paragraph', content: 'Server block' }],
            blocksVersion: 4,
            updatedAt: '2026-10-01T11:00:00.000Z',
        };

        useDatabaseStore.getState().hydrateDatabases([{ id: 'db-1', name: 'DB', pages: [serverPage] as any[] }]);

        const db = useDatabaseStore.getState().databases.find(d => d.id === 'db-1')!;
        const pageAfter = db.pages.find(p => p.id === 'page-dirty-1')!;

        assert.ok(pageAfter, 'Dirty page must not be evicted during hydration');
        assert.equal(pageAfter.properties.title, 'Local Unsaved Title', 'Local edited title must be preserved');
        assert.equal(pageAfter.blocks[0].content, 'Local unsaved block', 'Local edited blocks must be preserved');
    });

    test('hydrateDatabases updates baseUpdatedAt and blocksVersion from server row for dirty pages (OCC-13)', () => {
        const localDirtyPage = {
            id: 'page-dirty-occ',
            databaseId: 'db-1',
            properties: { title: 'Local Edit' },
            blocks: [],
            blocksVersion: 1,
            baseUpdatedAt: '2026-10-01T09:00:00.000Z',
            updatedAt: '2026-10-01T09:05:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-1', name: 'DB', pages: [localDirtyPage] as any[] }],
            syncQueue: [{ pageId: 'page-dirty-occ', databaseId: 'db-1', retryCount: 0 }],
        });

        const serverPage = {
            id: 'page-dirty-occ',
            databaseId: 'db-1',
            properties: { title: 'Server Edit' },
            blocks: [],
            blocksVersion: 7,
            updatedAt: '2026-10-01T10:00:00.000Z',
        };

        useDatabaseStore.getState().hydrateDatabases([{ id: 'db-1', name: 'DB', pages: [serverPage] as any[] }]);

        const pageAfter = useDatabaseStore.getState().databases[0].pages[0];
        // OCC-13 invariant: adopts server's updatedAt as baseUpdatedAt and blocksVersion to prevent false stale write loops
        assert.equal(pageAfter.baseUpdatedAt, '2026-10-01T10:00:00.000Z');
        assert.equal(pageAfter.blocksVersion, 7);
    });

    test('hydrateDatabases preserves local pages in syncQueue that do not exist yet on server', () => {
        const offlineCreatedPage = {
            id: 'page-offline-new',
            databaseId: 'db-1',
            properties: { title: 'Newly Created Offline' },
            blocks: [],
            blocksVersion: 1,
            updatedAt: '2026-10-01T10:00:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-1', name: 'DB', pages: [offlineCreatedPage] as any[] }],
            syncQueue: [{ pageId: 'page-offline-new', databaseId: 'db-1', retryCount: 0 }],
        });

        // Server hydration contains entirely different pages, not including offlineCreatedPage
        const serverPage = {
            id: 'page-server-existing',
            databaseId: 'db-1',
            properties: { title: 'Existing Server Row' },
            blocks: [],
            blocksVersion: 1,
            updatedAt: '2026-10-01T09:00:00.000Z',
        };

        useDatabaseStore.getState().hydrateDatabases([{ id: 'db-1', name: 'DB', pages: [serverPage] as any[] }]);

        const pages = useDatabaseStore.getState().databases[0].pages;
        assert.equal(pages.length, 2);
        assert.ok(pages.some(p => p.id === 'page-offline-new'), 'Offline-created page must be retained in database');
    });

    test('loadDatabasePages merges server pages while preserving local edits for pages in syncQueue', async () => {
        const localPage = {
            id: 'p-in-flight-dirty',
            databaseId: 'db-load',
            properties: { title: 'Unsaved Local Properties', priority: 'high' },
            blocks: [{ id: 'b1', content: 'Local content' }],
            blocksVersion: 1,
            baseUpdatedAt: '2026-10-01T10:00:00.000Z',
            updatedAt: '2026-10-01T10:05:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-load', name: 'DB Load', pages: [localPage] as any[] }],
            syncQueue: [{ pageId: 'p-in-flight-dirty', databaseId: 'db-load', retryCount: 0 }],
            loadedDatabaseIds: [],
        });

        setMockGetDatabasePages(async () => {
            return [{
                id: 'p-in-flight-dirty',
                databaseId: 'db-load',
                properties: { title: 'Stale Server Title', priority: 'low' },
                blocks: [{ id: 'b1', content: 'Stale server content' }],
                blocksVersion: 5,
                updatedAt: '2026-10-01T11:00:00.000Z',
            }];
        });

        const mergedPages = await useDatabaseStore.getState().loadDatabasePages('db-load');

        assert.equal(mergedPages.length, 1);
        assert.equal(mergedPages[0].properties.title, 'Unsaved Local Properties');
        assert.equal(mergedPages[0].baseUpdatedAt, '2026-10-01T11:00:00.000Z');
        assert.equal(mergedPages[0].blocksVersion, 5);
    });

    test('loadDatabasePages preserves local unsaved pages in syncQueue not yet present on server', async () => {
        const localUnsaved = {
            id: 'p-unsaved-not-on-server',
            databaseId: 'db-load',
            properties: { title: 'Not On Server Yet' },
            blocks: [],
            blocksVersion: 1,
            updatedAt: '2026-10-01T10:00:00.000Z',
        };

        useDatabaseStore.setState({
            databases: [{ id: 'db-load', name: 'DB Load', pages: [localUnsaved] as any[] }],
            syncQueue: [{ pageId: 'p-unsaved-not-on-server', databaseId: 'db-load', retryCount: 0 }],
            loadedDatabaseIds: [],
        });

        setMockGetDatabasePages(async () => {
            // Server returns empty array (or other pages)
            return [];
        });

        const mergedPages = await useDatabaseStore.getState().loadDatabasePages('db-load');

        assert.equal(mergedPages.length, 1);
        assert.equal(mergedPages[0].id, 'p-unsaved-not-on-server');
    });
});

describe('6 · partialize — IndexedDB persistence filter', () => {
    test('partialize drops clean pages and retains only pages with dirtyBase or dirtyBaseBlocks', () => {
        const partialize = useDatabaseStore.persist?.getOptions()?.partialize;
        assert.ok(partialize, 'Store persist partialize function must be defined');

        const stateToPersist = {
            databases: [{
                id: 'db-persist',
                name: 'Persistence DB',
                pages: [
                    { id: 'page-clean-1', properties: { title: 'Clean 1' }, blocks: [{ id: 'b1' }] },
                    { id: 'page-clean-2', properties: { title: 'Clean 2' }, blocks: [] },
                    { id: 'page-dirty-props', properties: { title: 'Dirty Props' }, dirtyBase: { title: 'Clean Props' }, blocks: [{ id: 'b2' }] },
                    { id: 'page-dirty-blocks', properties: { title: 'Dirty Blocks' }, dirtyBaseBlocks: true, blocks: [{ id: 'b3' }] },
                ],
            }],
            syncQueue: [{ pageId: 'page-dirty-props', databaseId: 'db-persist', retryCount: 0 }],
            sessionTenantId: 'tenant-123',
            sessionUserId: 'user-456',
            undoStack: ['action1', 'action2'],
            _hasHydrated: true,
            loadingDatabaseIds: ['db-persist'],
        };

        const result = partialize(stateToPersist as any) as any;
        const persistedDb = result.databases[0];

        // Clean pages dropped
        assert.equal(persistedDb.pages.length, 2, 'Only the 2 dirty pages must be persisted');
        assert.ok(!persistedDb.pages.some((p: any) => p.id === 'page-clean-1'), 'Clean page 1 must be dropped');
        assert.ok(!persistedDb.pages.some((p: any) => p.id === 'page-clean-2'), 'Clean page 2 must be dropped');
        assert.ok(persistedDb.pages.some((p: any) => p.id === 'page-dirty-props'), 'Page with dirtyBase must be retained');
        assert.ok(persistedDb.pages.some((p: any) => p.id === 'page-dirty-blocks'), 'Page with dirtyBaseBlocks must be retained');
    });

    test('partialize strips blocks (sets undefined) unless dirtyBaseBlocks is true', () => {
        const partialize = useDatabaseStore.persist?.getOptions()?.partialize;
        assert.ok(partialize);

        const stateToPersist = {
            databases: [{
                id: 'db-blocks',
                pages: [
                    // Only dirtyBase (property edit): blocks must be stripped
                    {
                        id: 'p-props-only',
                        properties: { title: 'Edited' },
                        dirtyBase: { title: 'Base' },
                        blocks: [{ id: 'b1', content: 'Large block data' }],
                    },
                    // dirtyBaseBlocks is true (content edit): blocks must be preserved
                    {
                        id: 'p-blocks-edited',
                        properties: { title: 'Same' },
                        dirtyBaseBlocks: true,
                        blocks: [{ id: 'b2', content: 'Edited block data' }],
                    },
                ],
            }],
        };

        const result = partialize(stateToPersist as any) as any;
        const pages = result.databases[0].pages;

        const propsOnlyPage = pages.find((p: any) => p.id === 'p-props-only');
        const blocksEditedPage = pages.find((p: any) => p.id === 'p-blocks-edited');

        assert.equal(propsOnlyPage.blocks, undefined, 'Blocks must be stripped when dirtyBaseBlocks is falsy');
        assert.ok(Array.isArray(blocksEditedPage.blocks), 'Blocks must be preserved when dirtyBaseBlocks is true');
        assert.equal(blocksEditedPage.blocks.length, 1);
        assert.equal(blocksEditedPage.blocks[0].content, 'Edited block data');
    });

    test('partialize excludes transient runtime fields: undoStack, _hasHydrated, loadingDatabaseIds', () => {
        const partialize = useDatabaseStore.persist?.getOptions()?.partialize;
        assert.ok(partialize);

        const stateToPersist = {
            databases: [],
            undoStack: ['u1', 'u2'],
            _hasHydrated: true,
            loadingDatabaseIds: ['db-load-1'],
            sessionTenantId: 't-1',
            sessionUserId: 'u-1',
            pageIndex: { 'p-1': { id: 'p-1' } },
            syncQueue: [],
        };

        const result = partialize(stateToPersist as any) as any;

        assert.equal(result.undoStack, undefined, 'undoStack must be excluded');
        assert.equal(result._hasHydrated, undefined, '_hasHydrated must be excluded');
        assert.equal(result.loadingDatabaseIds, undefined, 'loadingDatabaseIds must be excluded');
    });

    test('partialize preserves session and queue state: syncQueue, sessionTenantId, sessionUserId, pageIndex', () => {
        const partialize = useDatabaseStore.persist?.getOptions()?.partialize;
        assert.ok(partialize);

        const stateToPersist = {
            databases: [],
            sessionTenantId: 'tenant-xyz',
            sessionUserId: 'user-abc',
            syncQueue: [{ pageId: 'p-queued', databaseId: 'db-1', retryCount: 2 }],
            syncStatus: 'retrying',
            pendingSyncs: 1,
            pageIndex: { 'p-queued': { id: 'p-queued', databaseId: 'db-1', title: 'Q', updatedAt: '2026-10-01' } },
        };

        const result = partialize(stateToPersist as any) as any;

        assert.equal(result.sessionTenantId, 'tenant-xyz');
        assert.equal(result.sessionUserId, 'user-abc');
        assert.equal(result.syncQueue.length, 1);
        assert.equal(result.syncQueue[0].pageId, 'p-queued');
        assert.equal(result.syncStatus, 'retrying');
        assert.equal(result.pendingSyncs, 1);
        assert.ok(result.pageIndex['p-queued']);
    });
});

describe('STORE-LOAD-1 · the schema-only database list never empties pages a screen fetched', () => {
    beforeEach(() => { resetStoreState(); });

    test('Florin 2026-10-08 (no tasks on mobile): pages read this session survive the list that arrives after them', async () => {
        setMockGetDatabasePages(async () => [{ id: 't1', databaseId: 'db-tasks-x', properties: { title: 'Tegels' }, blocks: [], updatedAt: '2026-10-08T08:00:00.000Z' }]);
        // the screen fetched BEFORE the list arrived — no entry for the database yet
        await useDatabaseStore.getState().loadDatabasePages('db-tasks-x');
        assert.deepEqual(useDatabaseStore.getState().getDatabase('db-tasks-x')?.pages.map(p => p.id), ['t1']);
        // the list (schemas only, lazy data) arrives
        useDatabaseStore.getState().hydrateDatabases([{ id: 'db-tasks-x', name: 'Tasks', pages: [], properties: [{ id: 'title', name: 'Titel', type: 'text' }], views: [] } as any]);
        const db = useDatabaseStore.getState().getDatabase('db-tasks-x');
        assert.deepEqual(db?.pages.map(p => p.id), ['t1'], 'the fetched tasks are still there');
        assert.equal(db?.name, 'Tasks', 'the schema came from the list');
        assert.ok(useDatabaseStore.getState().loadedDatabaseIds.includes('db-tasks-x'));
    });

    test('pages only from the browser cache stay visible but are re-read (not marked loaded)', () => {
        useDatabaseStore.setState({
            databases: [{ id: 'db-cache-only', name: 'C', pages: [{ id: 'old', databaseId: 'db-cache-only', properties: {}, blocks: [], updatedAt: '2026-01-01T00:00:00.000Z' }] as any[] } as any],
            loadedDatabaseIds: ['db-cache-only'],
        });
        useDatabaseStore.getState().hydrateDatabases([{ id: 'db-cache-only', name: 'C', pages: [], properties: [], views: [] } as any]);
        assert.deepEqual(useDatabaseStore.getState().getDatabase('db-cache-only')?.pages.map(p => p.id), ['old']);
        assert.equal(useDatabaseStore.getState().loadedDatabaseIds.includes('db-cache-only'), false, 'the screen will re-read it');
    });
});


describe('LIVE-1 · an open screen picks up a change made on another device', () => {
    beforeEach(() => { resetStoreState(); });

    test('Florin 2026-10-08: a receipt saved on the phone appears on the open desktop list', async () => {
        let server = [{ id: 'r1', databaseId: 'db-live', properties: {}, blocks: [], updatedAt: '2026-10-08T08:00:00.000Z' }];
        setMockGetDatabasePages(async () => server);
        useDatabaseStore.setState({ databases: [{ id: 'db-live', name: 'Tickets', pages: [] as any[] } as any] });
        await useDatabaseStore.getState().loadDatabasePages('db-live');

        // nothing changed elsewhere → no re-read
        setMockGetDatabaseVersion(async () => ({ count: 1, lastUpdatedAt: '2026-10-08T08:00:00.000Z' }));
        assert.equal(await useDatabaseStore.getState().refreshIfChanged('db-live'), false);

        // the phone saved a receipt
        server = [...server, { id: 'r2', databaseId: 'db-live', properties: {}, blocks: [], updatedAt: '2026-10-08T09:00:00.000Z' }];
        setMockGetDatabaseVersion(async () => ({ count: 2, lastUpdatedAt: '2026-10-08T09:00:00.000Z' }));
        assert.equal(await useDatabaseStore.getState().refreshIfChanged('db-live'), true);
        assert.deepEqual(useDatabaseStore.getState().getDatabase('db-live')?.pages.map(p => p.id).sort(), ['r1', 'r2']);
    });

    test('a database this screen never read is not polled into existence', async () => {
        setMockGetDatabaseVersion(async () => ({ count: 5, lastUpdatedAt: '2026-10-08T09:00:00.000Z' }));
        assert.equal(await useDatabaseStore.getState().refreshIfChanged('db-never'), false);
    });
});

describe('SYNC-STUCK-1 · a change that keeps failing never blocks the queue nor keeps a stale copy on screen', () => {
    beforeEach(() => { resetStoreState(); });

    test('Florin 2026-10-08 ("updates reset scanned items"): the stuck change is given up, the next one is saved, the server version is shown', async () => {
        const stale = { id: 'stuck', databaseId: 'db-t', properties: { title: 'Brico', amount: '' }, dirtyBase: { title: 'Brico' }, blocks: [], updatedAt: '2026-10-08T08:00:00.000Z' };
        const next = { id: 'next', databaseId: 'db-t', properties: { title: 'Hubo', amount: 9 }, dirtyBase: { title: 'Hubo' }, blocks: [], updatedAt: '2026-10-08T08:00:00.000Z' };
        useDatabaseStore.setState({
            databases: [{ id: 'db-t', name: 'Tickets', pages: [stale, next] as any[] } as any],
            loadedDatabaseIds: ['db-t'],
            syncQueue: [{ pageId: 'stuck', databaseId: 'db-t', retryCount: 5 }, { pageId: 'next', databaseId: 'db-t', retryCount: 0 }],
        });
        const saved: string[] = [];
        setMockSaveGlobalPage(async (page: any) => { saved.push(page.id); return { success: true, updatedAt: '2026-10-08T09:00:00.000Z' }; });
        // the server holds the scanned values
        setMockGetDatabasePages(async () => [
            { id: 'stuck', databaseId: 'db-t', properties: { title: 'Brico', amount: 12.5, category: 'cat-tools' }, blocks: [], updatedAt: '2026-10-08T08:30:00.000Z' },
            { id: 'next', databaseId: 'db-t', properties: { title: 'Hubo', amount: 9 }, blocks: [], updatedAt: '2026-10-08T09:00:00.000Z' },
        ]);

        await useDatabaseStore.getState()._processSyncQueue();
        await new Promise(r => setTimeout(r, 20));   // the server re-read

        assert.deepEqual(saved, ['next'], 'the change behind the stuck one reached the server');
        assert.equal(useDatabaseStore.getState().syncQueue.length, 0, 'nothing stays queued forever');
        const shown = useDatabaseStore.getState().getDatabase('db-t')?.pages.find(p => p.id === 'stuck');
        assert.equal(shown?.properties.amount, 12.5, 'the server version is shown, not the stale local copy');
    });
});

describe('SYNC-BLIND-1 · a one-field edit keeps its snapshot; a confirmed page carries its server version', () => {
    beforeEach(() => { resetStoreState(); });

    test('updatePageProperty keeps the before-snapshot (it was computed and thrown away)', () => {
        useDatabaseStore.setState({ databases: [{ id: 'db-s', name: 'T', properties: [], pages: [{ id: 'p', databaseId: 'db-s', properties: { amount: 5, notes: '' }, blocks: [], updatedAt: '2026-10-08T08:00:00.000Z' }] as any[] } as any] });
        useDatabaseStore.getState().updatePageProperty('db-s', 'p', 'notes', 'x');
        const page = useDatabaseStore.getState().getDatabase('db-s')?.pages[0] as any;
        assert.deepEqual(page.dirtyBase, { amount: 5, notes: '' });
    });

    test('addConfirmedPage records the server version, and a newer server copy replaces a clean older one', () => {
        useDatabaseStore.setState({ databases: [{ id: 'db-s', name: 'T', pages: [{ id: 'p', databaseId: 'db-s', properties: { amount: 0 }, blocks: [], updatedAt: '2026-10-05T12:00:00.000Z' }] as any[] } as any] });
        useDatabaseStore.getState().addConfirmedPage({ id: 'p', databaseId: 'db-s', properties: { amount: 36.7 }, blocks: [], updatedAt: '2026-10-08T21:35:23.868Z' } as any);
        const page = useDatabaseStore.getState().getDatabase('db-s')?.pages[0] as any;
        assert.equal(page.properties.amount, 36.7);
        assert.equal(page.baseUpdatedAt, '2026-10-08T21:35:23.868Z');
    });
});
