/**
 * CACHE-OWNER-1 (Florin 2026-10-10: "make sure this doesn't leak cross tenant"). A copy of data kept in the browser
 * belongs to one tenant AND one user. Before: the database store's IndexedDB copy dropped its owner on restore, so
 * after a reload another account — or the next tenant a superadmin impersonated — got its page titles and unsynced
 * pages; the timesheets session cache was keyed by the query alone.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cacheUsableBy, ownerKey } from '../src/lib/records/browser-cache-owner.ts';

describe('CACHE-OWNER-1 · the rule (core)', () => {
    const A = { tenantId: 't-a', userId: 'u-1' };
    test('the same tenant and user may use the copy', () => assert.equal(cacheUsableBy(A, { ...A }), true));
    test('another tenant, or another user of the same tenant, may not', () => {
        assert.equal(cacheUsableBy(A, { tenantId: 't-b', userId: 'u-1' }), false);
        assert.equal(cacheUsableBy(A, { tenantId: 't-a', userId: 'u-2' }), false);
    });
    test('an unknown owner (an old copy) is never trusted', () => {
        assert.equal(cacheUsableBy({ tenantId: null, userId: null }, A), false);
        assert.equal(cacheUsableBy({ tenantId: 't-a', userId: undefined }, A), false);
    });
    test('ownerKey: null until both are known', () => {
        assert.equal(ownerKey(A), 't-a|u-1');
        assert.equal(ownerKey({ tenantId: 't-a', userId: null }), null);
    });
});

describe('CACHE-OWNER-1 · where the rule is applied', () => {
    const STORE = readFileSync('src/components/admin/database/store.ts', 'utf8');
    test('the store applies a restored copy only to its owner; an unknown identity defers it', () => {
        const merge = STORE.slice(STORE.indexOf('merge: (persistedState: any, currentState: DatabaseState) => {'), STORE.indexOf('onRehydrateStorage:'));
        assert.match(merge, /if \(!who\.tenantId\) \{ deferredCopy = persistedState/);
        assert.match(merge, /if \(cacheUsableBy\(owner, who\)\) return mergePersisted\(persistedState, currentState\);\s*if \(persistedState\) wipeBrowserCopy\(\);/);
    });
    test('setSession empties the store for another tenant OR user, and applies a deferred copy only to its owner', () => {
        const at = STORE.indexOf('setSession: (tenantId, userId) => {');
        const fn = STORE.slice(at, STORE.indexOf('hydratePageIndex:', at));
        assert.match(fn, /!cacheUsableBy\(\{ tenantId: s\.sessionTenantId, userId: s\.sessionUserId \}, who\)\) \{\s*get\(\)\.clearStore\(\)/);
        assert.match(fn, /if \(cacheUsableBy\(\{ tenantId: copy\.sessionTenantId, userId: copy\.sessionUserId \}, who\)\) set\(state => mergePersisted\(copy, state\)\);\s*else wipeBrowserCopy\(\);/);
        assert.match(fn, /get\(\)\.clearStore\(\);\s*wipeBrowserCopy\(\);/);
    });
    test('another identity\'s copy is removed from storage, not just hidden', () => {
        assert.match(STORE, /function wipeBrowserCopy\(\) \{[\s\S]{0,300}useDatabaseStore\.persist\.clearStorage\(\)/);
    });
    test('both shells tell the store who is signed in ahead of the screens (outside Suspense)', () => {
        for (const p of ['src/app/[locale]/admin/layout.tsx', 'src/app/[locale]/m/layout.tsx']) {
            const s = readFileSync(p, 'utf8');
            const guard = s.indexOf('<StoreSession tenantId={tenantId}');
            assert.ok(guard > 0, p);
            assert.ok(guard < s.indexOf('<Suspense fallback={null}>'), `${p}: StoreSession before the streamed loader`);
        }
        assert.match(readFileSync('src/components/admin/database/StoreSession.tsx', 'utf8'), /useLayoutEffect\(\(\) => \{\s*if \(tenantId && userId\) useDatabaseStore\.getState\(\)\.setSession\(tenantId, userId\)/);
    });
    test('the timesheets session cache and in-flight requests are keyed by the identity', () => {
        const page = readFileSync('src/app/[locale]/admin/hr/timesheets/page.tsx', 'utf8');
        assert.match(page, /const cacheKeyOf = \(query: string\) => \(owner \? `\$\{owner\}\|\$\{query\}` : null\);/);
        assert.doesNotMatch(page, /reportCache\.(get|set|has)\((key|withDefaultPeriod)/);
        assert.match(page, /if \(!cacheKey\) return hrFetch<Report>/);
    });
});
