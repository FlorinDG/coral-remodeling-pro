import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesOf, searchLines, libraryUnitOf, matchArticle, articleFieldsFromLine, priceHistoryOf, ARTICLE_SUPPLIER_CODE, ARTICLE_PRICE_HISTORY } from '../src/lib/records/purchase-line-search.ts';

const row = (id: string, content: string, p: Record<string, unknown>) => ({ id, type: 'financial-row', content, properties: p });
const invoice = {
    id: 'inv1', databaseId: 'db-exp', role: 'expenses',
    properties: { title: 'F-118', supplierName: 'Desco', invoiceDate: '2026-09-30', supplier: ['sup-desco'] },
    blocks: [
        row('l1', 'Vloertegel <b>60x60</b> mat', { quantity: 20, unitCode: 'MTK', unitPrice: 45, discountPct: 10, lineTotal: 810, articleCode: 'TG-6060' }),
        row('l2', 'Tegellijm 25kg', { quantity: 4, unitCode: 'C62', unitPrice: 18, discountPct: 0, lineTotal: 72 }),
        { id: 'txt', type: 'text', content: 'Leveringsvoorwaarden' },
    ],
};
const quote = {
    id: 'q1', databaseId: 'db-pq', role: 'purchase-quotes',
    properties: { title: 'OFF-9', supplierName: 'Desco', invoiceDate: '2026-10-05', supplier: [] },
    blocks: [row('ql1', 'Vloertégel 60x60 mat', { quantity: 1, unitPrice: 42, discountPct: 12, lineTotal: 36.96, articleCode: 'TG-6060' })],
};

test('the lines of a document — rows only, with the document\'s supplier and date, markup removed', () => {
    const lines = linesOf(invoice);
    assert.deepEqual(lines.map(l => l.lineId), ['l1', 'l2']);
    assert.equal(lines[0].description, 'Vloertegel 60x60 mat');
    assert.equal(lines[0].supplier, 'Desco');
    assert.equal(lines[0].date, '2026-09-30');
});

test('Florin 2026-10-08: every word typed, in invoices AND supplier quotes, accents ignored — newest first', () => {
    const hits = searchLines([invoice, quote], 'tegel 60x60');
    assert.deepEqual(hits.map(h => h.documentId), ['q1', 'inv1']);
    assert.deepEqual(searchLines([invoice, quote], 'tg-6060 desco').map(h => h.lineId), ['ql1', 'l1']);
    assert.deepEqual(searchLines([invoice, quote], 'lijm').map(h => h.lineId), ['l2']);
    assert.deepEqual(searchLines([invoice, quote], '   '), []);
});

test('the unit follows the document\'s unit code; unknown is stuk', () => {
    assert.equal(libraryUnitOf('MTK'), 'u-m2');
    assert.equal(libraryUnitOf('KGM'), 'u-kg');
    assert.equal(libraryUnitOf('XYZ'), 'u-stk');
    assert.equal(libraryUnitOf(undefined), 'u-stk');
});

test('a new article: name, supplier code, supplier, unit, gross and discount — and no VAT', () => {
    const [hit] = searchLines([invoice], 'tegel');
    const f = articleFieldsFromLine(hit, 'u-m2', null);
    assert.equal(f.title, 'Vloertegel 60x60 mat');
    assert.equal(f[ARTICLE_SUPPLIER_CODE], 'TG-6060');
    assert.deepEqual(f['prop-art-supplier'], ['sup-desco']);
    assert.equal(f['prop-art-bruto'], 45);
    assert.equal(f['prop-art-remise'], 10);
    assert.equal(Object.keys(f).some(k => /vat|btw/i.test(k)), false);
    assert.equal(priceHistoryOf(f[ARTICLE_PRICE_HISTORY]).length, 1);
});

test('an existing article (same supplier, same code) gets the new price; the old one stays in the history', () => {
    const [newer] = searchLines([quote], 'tegel');
    const article = { id: 'art1', properties: { [ARTICLE_SUPPLIER_CODE]: 'tg-6060', 'prop-art-supplier': ['sup-desco'], [ARTICLE_PRICE_HISTORY]: JSON.stringify([{ date: '2026-09-30', gross: 45, discount: 10, supplier: 'Desco', documentId: 'inv1' }]) } };
    assert.equal(matchArticle(newer, [article]), 'art1');                  // unlinked quote: matched by supplier name in the history
    const f = articleFieldsFromLine(newer, 'u-stk', article.properties);
    assert.equal(f['prop-art-bruto'], 42);
    assert.equal('title' in f, false);                                      // the name a person gave it stays
    assert.deepEqual(priceHistoryOf(f[ARTICLE_PRICE_HISTORY]).map(e => e.gross), [45, 42]);
    assert.equal(matchArticle({ ...newer, articleCode: '' }, [article]), null);   // no code → never guessed
    assert.equal(matchArticle({ ...newer, supplier: 'Other', supplierIds: [] }, [article]), null);
});
