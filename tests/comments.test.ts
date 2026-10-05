import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionedIds, plainText, cleanBody, commentRefusal, latestComment, COMMENT_MAX } from '../src/lib/records/comments.ts';

test('mentions: only this tenant\'s users, once each; plain text shows @Name', () => {
    const body = 'Hoi @[Ann](u1), zie ook @[Bob](u2) en @[Ann](u1) — @[Eve](x9)';
    assert.deepEqual(mentionedIds(body, ['u1', 'u2']), ['u1', 'u2']);
    assert.equal(plainText(body), 'Hoi @Ann, zie ook @Bob en @Ann — @Eve');
});

test('a body is trimmed, never empty, never over the limit', () => {
    assert.equal(cleanBody('  ok \r\n'), 'ok');
    assert.equal(cleanBody('   '), null);
    assert.equal(cleanBody(42), null);
    assert.equal(cleanBody('x'.repeat(COMMENT_MAX + 1)), null);
});

test('edit: author only · delete: author or admin · resolve: anyone · a deleted comment: nothing (throw proof: an admin edit)', () => {
    const c = { id: 'c1', authorId: 'u1', createdAt: '2026-10-05T10:00:00Z', body: 'x' };
    assert.equal(commentRefusal('edit', c, { userId: 'u1', isAdmin: false }), null);
    assert.equal(commentRefusal('edit', c, { userId: 'u2', isAdmin: true }), 'not_author');
    assert.equal(commentRefusal('delete', c, { userId: 'u2', isAdmin: true }), null);
    assert.equal(commentRefusal('delete', c, { userId: 'u2', isAdmin: false }), 'not_author');
    assert.equal(commentRefusal('resolve', c, { userId: 'u3', isAdmin: false }), null);
    assert.equal(commentRefusal('resolve', { ...c, deletedAt: '2026-10-05T11:00:00Z' }, { userId: 'u1', isAdmin: true }), 'deleted');
    assert.equal(commentRefusal('edit', null, { userId: 'u1', isAdmin: true }), 'not_found');
});

test('the field shows the most recent LIVE comment, the count and the unresolved count', () => {
    assert.equal(latestComment([]), null);
    const l = latestComment([
        { id: 'a', authorId: 'u1', createdAt: '2026-10-05T09:00:00.000Z', body: 'eerste', resolvedAt: '2026-10-05T09:30:00.000Z' },
        { id: 'b', authorId: 'u2', createdAt: '2026-10-05T11:00:00.000Z', body: 'nieuwste @[Ann](u1)' },
        { id: 'c', authorId: 'u3', createdAt: '2026-10-05T12:00:00.000Z', body: 'gewist', deletedAt: '2026-10-05T12:05:00.000Z' },
    ])!;
    assert.equal(l.body, 'nieuwste @Ann');
    assert.equal(l.authorId, 'u2');
    assert.equal(l.count, 2);
    assert.equal(l.open, 1);
});
