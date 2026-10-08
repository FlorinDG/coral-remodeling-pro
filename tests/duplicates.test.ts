import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareDuplicate, findDuplicates, duplicateFlag, hasDuplicateFlag, clearDuplicateFlag, DUPLICATE_FIELD } from '../src/lib/records/duplicates.ts';

const ticket = (title: string, date: string, amount: number) => ({ title, date, amount });
const inv = (p: Record<string, unknown>) => ({ supplierName: 'Desco', invoiceDate: '2026-10-01', totalIncVat: 121, ...p });

test('Florin 2026-10-08: the same receipt photographed twice is a duplicate', () => {
    const m = compareDuplicate('tickets', ticket('Brico', '2026-10-02', 12.5), ticket('BRICO ', '2026-10-02', '12,50' as unknown as number));
    assert.equal(m?.strength, 'duplicate');
});

test('same amount, same day, other shop: worth a look — not called the same', () => {
    assert.equal(compareDuplicate('tickets', ticket('Brico', '2026-10-02', 12.5), ticket('Hubo', '2026-10-02', 12.5))?.strength, 'possible');
    assert.equal(compareDuplicate('tickets', ticket('Brico', '2026-10-02', 12.5), ticket('Brico', '2026-10-03', 9)), null);
});

test('a purchase invoice: the same supplier\'s same number is a duplicate — the number is the TITLE (the old check read invoiceNumber)', () => {
    const m = compareDuplicate('expenses', inv({ title: 'F-2026-118', totalIncVat: 121 }), inv({ title: 'f-2026-118', totalIncVat: 99, invoiceDate: '2026-10-05' }));
    assert.equal(m?.strength, 'duplicate');
    assert.ok(m?.fields.includes('nummer'));
});

test('the VAT number decides the supplier when both carry one', () => {
    const a = inv({ supplierName: 'Desco NV', supplierVat: 'BE 0123.456.789' });
    const b = inv({ supplierName: 'DESCO', supplierVat: 'BE0123456789' });
    assert.equal(compareDuplicate('expenses', a, b)?.strength, 'duplicate');   // same vat, day, amount
    assert.equal(compareDuplicate('expenses', a, inv({ supplierVat: 'BE0999999999' }))?.strength, 'possible');   // other vat: same day + amount only
});

test('findDuplicates never matches the record itself and puts the strongest first', () => {
    const me = { id: 'me', properties: ticket('Brico', '2026-10-02', 12.5) };
    const out = findDuplicates('tickets', me, [
        me,
        { id: 'look', properties: ticket('Hubo', '2026-10-02', 12.5) },
        { id: 'same', properties: ticket('Brico', '2026-10-02', 12.5) },
        { id: 'other', properties: ticket('Aldi', '2026-09-01', 3) },
    ]);
    assert.deepEqual(out.map(m => [m.id, m.strength]), [['same', 'duplicate'], ['look', 'possible']]);
});

test('the flag waits for a person; keeping clears only the duplicate reason', () => {
    const flag = duplicateFlag([{ id: 'same', strength: 'duplicate', fields: ['leverancier', 'datum', 'bedrag'] }]);
    assert.deepEqual(flag[DUPLICATE_FIELD], ['same']);
    assert.equal(flag.reviewStatus, 'Na te kijken');
    assert.equal(hasDuplicateFlag(flag), true);
    assert.deepEqual(duplicateFlag([]), {});
    assert.deepEqual(clearDuplicateFlag({ reviewReason: String(flag.reviewReason) }), { [DUPLICATE_FIELD]: [], reviewReason: '' });
    assert.deepEqual(clearDuplicateFlag({ reviewReason: 'Ontbreekt: datum' }), { [DUPLICATE_FIELD]: [] });
    assert.equal(hasDuplicateFlag({ [DUPLICATE_FIELD]: [] }), false);
});
