import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientAcceptRefusal } from '../src/lib/records/client-accept.ts';

// R2-1-CENSUS #9/#10: the public accept actions took ANY record id.

test('a sent invoice / quote can be accepted', () => {
    assert.equal(clientAcceptRefusal('invoices', 'invoices', 'opt-sent'), null);
    assert.equal(clientAcceptRefusal('quotations', 'quotations', 'opt-sent'), null);
    assert.equal(clientAcceptRefusal('quotations', 'quotations', 'SENT'), null);   // legacy value
});

test('a record of another kind is refused — an article, a project, a quote id on the invoice action', () => {
    assert.equal(clientAcceptRefusal('invoices', 'articles', 'opt-sent'), 'wrong_kind');
    assert.equal(clientAcceptRefusal('quotations', 'projects', 'opt-sent'), 'wrong_kind');
    assert.equal(clientAcceptRefusal('invoices', 'quotations', 'opt-sent'), 'wrong_kind');
    assert.equal(clientAcceptRefusal('quotations', null, 'opt-sent'), 'wrong_kind');
});

test('only a SENT document: a draft, a rejected one or a missing status is refused', () => {
    for (const st of ['opt-draft', 'DRAFT', 'opt-rejected', 'REJECTED', 'DECLINED', '', undefined, null, 42]) {
        assert.equal(clientAcceptRefusal('quotations', 'quotations', st), 'not_sent', String(st));
    }
});

test('already accepted is said as such (both spellings)', () => {
    assert.equal(clientAcceptRefusal('quotations', 'quotations', 'ACCEPTED'), 'already_accepted');
    assert.equal(clientAcceptRefusal('quotations', 'quotations', 'opt-accepted'), 'already_accepted');
});

import { publicViewRefusal } from '../src/lib/records/client-accept.ts';

test('public VIEW: only the right kind, and never a draft (the id was parsed; drafts were public by link)', () => {
    assert.equal(publicViewRefusal('invoices', 'invoices', 'opt-sent'), null);
    assert.equal(publicViewRefusal('invoices', 'invoices', 'opt-paid'), null);
    assert.equal(publicViewRefusal('quotations', 'quotations', 'opt-accepted'), null);
    assert.equal(publicViewRefusal('invoices', 'invoices', 'opt-draft'), 'draft');
    assert.equal(publicViewRefusal('invoices', 'invoices', undefined), 'draft');
    assert.equal(publicViewRefusal('invoices', 'quotations', 'opt-sent'), 'wrong_kind');
    assert.equal(publicViewRefusal('quotations', null, 'opt-sent'), 'wrong_kind');
});
