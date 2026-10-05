import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opensInSideModal } from '../src/lib/databaseRoute.ts';
import { useRecordPeek } from '../src/lib/record-peek.ts';

test('CROSS-LINK-1: a linked record opens in the side modal — only invoice / quotation keep their own editor', () => {
    for (const role of ['projects', 'clients', 'tasks', 'crm', 'articles', 'bestek', 'tickets', 'expenses', null, undefined]) {
        assert.equal(opensInSideModal(role), true, String(role));
    }
    assert.equal(opensInSideModal('invoices'), false);
    assert.equal(opensInSideModal('quotations'), false);
});

test('CROSS-LINK-1: the peek stack — open on top, close returns to the one under it, same record not doubled', () => {
    const s = useRecordPeek.getState();
    s.clear();
    s.open('db-a', 'p1');
    s.open('db-b', 'p2');
    s.open('db-b', 'p2');   // a second click on the same link
    assert.deepEqual(useRecordPeek.getState().stack, [{ databaseId: 'db-a', pageId: 'p1' }, { databaseId: 'db-b', pageId: 'p2' }]);
    useRecordPeek.getState().close();
    assert.deepEqual(useRecordPeek.getState().stack, [{ databaseId: 'db-a', pageId: 'p1' }]);
    useRecordPeek.getState().clear();
    assert.equal(useRecordPeek.getState().stack.length, 0);
});
