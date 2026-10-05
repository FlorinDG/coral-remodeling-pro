import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleCounters, nextArticleCodes, articleImportPlan, articleGroupCode } from '../src/lib/records/article-import.ts';

test('ART codes continue each group\'s sequence; a row with a code keeps it', () => {
    const counters = articleCounters(['ART-01-0007', 'ART-01-0003', 'ART-02-0001', 'junk', null, 'ART-1-9']);
    assert.deepEqual(counters, { '01': 7, '02': 1 });
    const codes = nextArticleCodes([
        { group: 'opt-ruwbouw' },
        { group: 'opt-afwerking' },
        { group: 'opt-ruwbouw', code: 'ART-01-0100' },
        { group: undefined },
        { group: 'opt-ruwbouw' },
    ], counters);
    assert.deepEqual(codes, ['ART-01-0008', 'ART-02-0002', null, 'ART-00-0001', 'ART-01-0009']);
    assert.equal(articleGroupCode('opt-unknown'), '00');
});

test('import plan: same title + same supplier → update, or skip when identical; other supplier → new', () => {
    const existing = [
        { id: 'a', properties: { title: 'Gyproc 12,5', sup: ['s1'], price: 10 } },
        { id: 'b', properties: { title: 'Schroef', sup: ['s1'], price: 1 } },
    ];
    const plan = articleImportPlan([
        { title: '  gyproc 12,5 ', sup: ['s1'], price: 11 },   // same article, changed → update
        { title: 'Schroef', sup: ['s1'], price: 1 },           // identical → skipped
        { title: 'Schroef', sup: ['s2'], price: 1 },           // other supplier → create
        { title: 'Nieuw', sup: ['s1'], price: 5 },             // new → create
    ], existing, { title: 'title', supplier: 'sup', compare: ['title', 'sup', 'price'] });
    assert.deepEqual(plan.update.map(u => u.id), ['a']);
    assert.equal(plan.skipped, 1);
    assert.deepEqual(plan.create.map(r => `${r.title}/${(r.sup as string[])[0]}`), ['Schroef/s2', 'Nieuw/s1']);
});

test('throw proof: re-importing the same file twice creates nothing the second time', () => {
    const rows = [{ title: 'X', sup: ['s1'], price: 2 }];
    const first = articleImportPlan(rows, [], { title: 'title', supplier: 'sup', compare: ['title', 'sup', 'price'] });
    assert.equal(first.create.length, 1);
    const second = articleImportPlan(rows, [{ id: 'x', properties: { ...rows[0] } }], { title: 'title', supplier: 'sup', compare: ['title', 'sup', 'price'] });
    assert.equal(second.create.length, 0);
    assert.equal(second.skipped, 1);
});

test('fields the file does not carry (the ART code) never make an identical row look changed', () => {
    const existing = [{ id: 'a', properties: { title: 'X', sup: ['s1'], price: 2, 'prop-art-id': 'ART-01-0001' } }];
    const plan = articleImportPlan([{ title: 'X', sup: ['s1'], price: 2 }], existing, { title: 'title', supplier: 'sup', compare: ['title', 'sup', 'price', 'prop-art-id'] });
    assert.equal(plan.skipped, 1);
    assert.equal(plan.update.length, 0);
});
