/**
 * FILES-DUP-1 (Florin 2026-10-10: "duplicate code — sooner rather than later; check them both for gating, canonical
 * behaviour and dependencies"). Two "list a record's files" actions existed; the one without the crew fence
 * (actions/list-record-files) is gone, its callers use actions/files. The key scheme is written once (core).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { tenantFilePrefix, recordFilePrefix, recordFileKey, isTenantFileKey } from '../src/lib/records/file-keys.ts';

describe('FILES-DUP-1 · the key scheme (core)', () => {
    test('keys and prefixes', () => {
        assert.equal(tenantFilePrefix('A'), 't_A/');
        assert.equal(recordFilePrefix('A', 'project', 'p1'), 't_A/project/p1/');
        assert.equal(recordFilePrefix('A', 'project'), 't_A/project/');
        assert.equal(recordFileKey('A', 'project', 'p1', 'plan.pdf'), 't_A/project/p1/plan.pdf');
        assert.throws(() => tenantFilePrefix(''));
    });
    test('the tenant fence: another tenant\'s key, a look-alike tenant id, no tenant — all outside', () => {
        assert.equal(isTenantFileKey('t_A/project/p1/plan.pdf', 'A'), true);
        assert.equal(isTenantFileKey('t_B/project/p1/plan.pdf', 'A'), false);
        assert.equal(isTenantFileKey('t_AB/project/p1/plan.pdf', 'A'), false);
        assert.equal(isTenantFileKey('t_A/x', ''), false);
    });
});

describe('FILES-DUP-1 · one gated door', () => {
    test('the unguarded duplicate is gone and nothing imports it', () => {
        assert.equal(existsSync('src/app/actions/list-record-files.ts'), false);
        for (const p of ['src/components/shared/RecordAttachments.tsx', 'src/components/admin/quotations/QuoteSendModal.tsx']) {
            const s = readFileSync(p, 'utf8');
            assert.doesNotMatch(s, /list-record-files/, p);
            assert.match(s, /from '@\/app\/actions\/files'/, p);
        }
    });
    test('the file doors list behind the crew fence and build / check keys through the core scheme', () => {
        const files = readFileSync('src/app/actions/files.ts', 'utf8');
        const list = files.slice(files.indexOf('export async function listRecordFiles'), files.indexOf('export async function deleteFileAction'));
        assert.match(list, /crewFileRefusal\('list', recordType, recordId\)/);
        assert.match(list, /recordFilePrefix\(tenantId, recordType, recordId\)/);
        for (const p of ['src/app/actions/files.ts', 'src/app/api/files/[...key]/route.ts', 'src/app/actions/send-invoice.ts', 'src/app/actions/send-quote.ts']) {
            assert.doesNotMatch(readFileSync(p, 'utf8'), /`t_\$\{/, `${p} builds a key by hand`);
        }
    });
});
