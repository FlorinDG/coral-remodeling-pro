/**
 * OCC-MERGE-1 · the store's half: after a save it ADOPTS the fields the server kept from another user,
 * and a clean page carries NO base (the next edit snapshots a full one). Drives the real store.ts
 * through the R2-5 harness stubs.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useDatabaseStore } from '../src/components/admin/database/store.ts';
import { setMockSaveGlobalPage } from './stubs/global-databases.ts';

const page = (extra: Record<string, unknown> = {}) => ({
    id: 'p1', databaseId: 'db-1', blocks: [], blocksVersion: 1, dirtyBaseBlocks: false,
    updatedAt: '2026-10-01T12:05:00.000Z', baseUpdatedAt: '2026-10-01T12:00:00.000Z',
    properties: { title: 'Offerte v2', notes: 'old' },
    dirtyBase: { title: 'Offerte', notes: 'old' },
    ...extra,
});

beforeEach(() => {
    useDatabaseStore.setState({
        databases: [], syncQueue: [], syncStatus: 'idle', isProcessingQueue: false,
        sessionTenantId: 'tenant-test', sessionUserId: 'user-test',
    } as never);
});

test('a save that kept another user\'s field: the page takes it and becomes clean (no base)', async () => {
    setMockSaveGlobalPage(async () => ({ success: true, updatedAt: '2026-10-01T12:06:00.000Z', blocksVersion: 1, keptServer: { notes: 'B wrote this' } }));
    useDatabaseStore.setState({
        databases: [{ id: 'db-1', name: 'DB', pages: [page()] }],
        syncQueue: [{ pageId: 'p1', databaseId: 'db-1', retryCount: 0 }],
    } as never);
    await useDatabaseStore.getState()._processSyncQueue();
    const p = useDatabaseStore.getState().databases[0].pages[0];
    assert.equal(p.properties.notes, 'B wrote this');
    assert.equal(p.properties.title, 'Offerte v2');
    assert.equal(p.dirtyBase, undefined);
    assert.equal(p.baseUpdatedAt, '2026-10-01T12:06:00.000Z');
});

test('a field edited again while the save was in flight is NOT overwritten, and stays dirty against a full base', async () => {
    let resolve!: (v: unknown) => void;
    setMockSaveGlobalPage(() => new Promise(r => { resolve = r; }));
    useDatabaseStore.setState({
        databases: [{ id: 'db-1', name: 'DB', pages: [page()] }],
        syncQueue: [{ pageId: 'p1', databaseId: 'db-1', retryCount: 0 }],
    } as never);
    const run = useDatabaseStore.getState()._processSyncQueue();
    await new Promise(r => setTimeout(r, 0));
    // the user types into notes while the save is on the wire
    useDatabaseStore.setState(s => ({ databases: s.databases.map(d => ({ ...d, pages: d.pages.map(pg => ({ ...pg, properties: { ...pg.properties, notes: 'A typing' } })) })) }) as never);
    resolve({ success: true, updatedAt: '2026-10-01T12:06:00.000Z', blocksVersion: 1, keptServer: { notes: 'B wrote this' } });
    await run;
    const p = useDatabaseStore.getState().databases[0].pages[0];
    assert.equal(p.properties.notes, 'A typing');                    // the newer local edit wins locally
    assert.deepEqual(p.dirtyBase, { title: 'Offerte v2', notes: 'B wrote this' });   // full base = the row as saved
});
