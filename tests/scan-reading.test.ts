import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmptyReading, ticketFields } from '../src/lib/records/scan-reading.ts';

test('an empty reading is a FAILED reading (throw proof: saved as "Expense", €0, today)', () => {
    assert.equal(isEmptyReading({}, false), true);
    assert.equal(isEmptyReading(null, true), true);
    assert.equal(isEmptyReading({ merchant: '', totalAmount: null }, false), true);
    assert.equal(isEmptyReading({ totalAmount: 12.5 }, false), false);
    assert.equal(isEmptyReading({ invoiceNumber: 'F-1' }, true), false);
});

test('a partial reading writes only what it read — never an invented date, amount or title', () => {
    assert.deepEqual(ticketFields({ totalAmount: 12.5 }), { amount: 12.5, reviewStatus: 'Na te kijken', reviewReason: 'Niet gelezen: handelaar, datum' });
    assert.deepEqual(ticketFields({ merchant: 'Brico', date: '2026-10-02', totalAmount: 0, category: 'cat-tools' }),
        { title: 'Brico', date: '2026-10-02', amount: 0, category: 'cat-tools', reviewStatus: 'Na te kijken', reviewReason: '' });
});
