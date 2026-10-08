import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryComponents } from '../src/lib/records/library-components.ts';

let n = 0;
const id = () => `new-${++n}`;

test('Florin 2026-10-08: an article whose page body is an empty paragraph inserts with NO subcomponent', () => {
    assert.deepEqual(libraryComponents([{ id: 'p', type: 'paragraph', content: '' }] as never, id), []);
    assert.deepEqual(libraryComponents([], id), []);
    assert.deepEqual(libraryComponents(undefined, id), []);
});

test('notes in the body (text, headings, lists) never become components', () => {
    const body = [
        { id: 'h', type: 'heading_2', content: 'Plaatsing' },
        { id: 't', type: 'text', content: 'Leverancier X' },
        { id: 'b', type: 'bulleted_list_item', content: 'droog' },
    ];
    assert.deepEqual(libraryComponents(body as never, id), []);
});

test('a real composition (articles, lines) still comes along, with fresh ids, nested ones too', () => {
    const body = [
        { id: 'note', type: 'paragraph', content: 'zie plan' },
        { id: 'a1', type: 'article', content: 'Tegel', verkoopPrice: 45, children: [
            { id: 'a2', type: 'line', content: 'Lijm', verkoopPrice: 3 },
            { id: 'x', type: 'paragraph', content: '' },
        ] },
    ];
    const out = libraryComponents(body as never, id);
    assert.equal(out.length, 1);
    assert.equal(out[0].content, 'Tegel');
    assert.notEqual(out[0].id, 'a1');
    assert.deepEqual(out[0].children?.map(c => c.content), ['Lijm']);
});
