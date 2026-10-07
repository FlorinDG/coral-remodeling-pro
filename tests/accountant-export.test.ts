import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportKind, signed, selectForExport, signedSplit, vatSplit, type ExportDoc } from '../src/lib/records/accountant-export.ts';

test('kinds: a ticket by its database role (never by parsing the id); credit note by docType; a proforma is not exported', () => {
    assert.equal(exportKind('tickets', {}), 'ticket');
    assert.equal(exportKind('invoices', { docType: 'opt-credit-note' }), 'credit-note');
    assert.equal(exportKind('expenses', { docType: 'opt-credit-note' }), 'credit-note');
    assert.equal(exportKind('invoices', { docType: 'opt-invoice' }), 'invoice');
    assert.equal(exportKind('invoices', {}), 'invoice');
    assert.equal(exportKind('invoices', { docType: 'opt-proforma' }), null);
});

test('a credit note lowers the journal — negative whatever sign it was stored with; others unchanged', () => {
    assert.equal(signed('credit-note', 100), -100);
    assert.equal(signed('credit-note', -100), -100);
    assert.equal(signed('invoice', 100), 100);
    assert.equal(signed('ticket', 12.5), 12.5);
    assert.equal(signed('invoice', Number.NaN), 0);
    const s = signedSplit('credit-note', vatSplit({ properties: { totalExVat: 100, totalVat: 21 } }));
    assert.equal(s.base21, -100);
    assert.equal(s.vat21, -21);
});

const doc = (id: string, source: ExportDoc['source'], properties: Record<string, unknown>): ExportDoc => ({ id, source, properties });

test('the selection: period, drafts, undated, proforma, already exported', () => {
    const docs = [
        doc('inv', 'invoices', { invoiceDate: '2026-09-10', status: 'opt-sent' }),
        doc('cn', 'invoices', { invoiceDate: '2026-09-11', docType: 'opt-credit-note' }),
        doc('pro', 'invoices', { invoiceDate: '2026-09-12', docType: 'opt-proforma' }),
        doc('draft', 'invoices', { invoiceDate: '2026-09-12', status: 'opt-draft' }),
        doc('old', 'invoices', { invoiceDate: '2026-08-31' }),
        doc('nodate', 'expenses', {}),
        doc('tk', 'tickets', { date: '2026-09-20T00:00:00.000Z' }),
        doc('done', 'expenses', { invoiceDate: '2026-09-05', accountantExportedAt: true }),
    ];
    const sel = selectForExport(docs, { startDate: '2026-09-01', endDate: '2026-09-30', includeAlreadyExported: false });
    assert.deepEqual(sel.toExport.map(d => `${d.id}:${d.kind}`), ['inv:invoice', 'cn:credit-note', 'tk:ticket']);
    assert.deepEqual(sel.drafts.map(d => d.id), ['draft']);
    assert.deepEqual(sel.undated.map(d => d.id), ['nodate']);
    assert.deepEqual(sel.alreadyExported.map(d => d.id), ['done']);

    const again = selectForExport(docs, { startDate: '2026-09-01', endDate: '2026-09-30', includeAlreadyExported: true });
    assert.ok(again.toExport.some(d => d.id === 'done'));
    assert.ok(!again.toExport.some(d => d.id === 'pro'));
});

import { exportPeriod } from '../src/lib/records/accountant-export.ts';

test('periods are calendar dates — the last day of the month is IN (toISOString in Brussels dropped it)', () => {
    assert.deepEqual(exportPeriod('last-month', '2026-10-05'), { from: '2026-09-01', to: '2026-09-30' });
    assert.deepEqual(exportPeriod('last-month', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
    assert.deepEqual(exportPeriod('last-month', '2028-03-01'), { from: '2028-02-01', to: '2028-02-29' });
    assert.deepEqual(exportPeriod('last-trimester', '2026-10-05'), { from: '2026-07-01', to: '2026-09-30' });
    assert.deepEqual(exportPeriod('last-trimester', '2026-02-10'), { from: '2025-10-01', to: '2025-12-31' });
    assert.deepEqual(exportPeriod('last-semester', '2026-10-05'), { from: '2026-01-01', to: '2026-06-30' });
    assert.deepEqual(exportPeriod('last-semester', '2026-06-30'), { from: '2025-07-01', to: '2025-12-31' });
    assert.deepEqual(exportPeriod('this-year', '2026-10-05'), { from: '2026-01-01', to: '2026-10-05' });
    assert.deepEqual(exportPeriod('last-year', '2026-10-05'), { from: '2025-01-01', to: '2025-12-31' });
});

test('VALIDATE-1: a scan nobody validated is never exported — Peppol and approved ones are (throw proof: the unread "Expense / €0")', () => {
    const docs = [
        doc('scan', 'tickets', { title: 'Expense', date: '2026-09-20', amount: 0, source: 'src-scan', reviewStatus: 'Na te kijken' }),
        doc('ok', 'tickets', { title: 'Brico', date: '2026-09-20', amount: 12, source: 'src-scan', reviewStatus: 'Goedgekeurd' }),
        doc('pep', 'expenses', { invoiceDate: '2026-09-21', source: 'src-peppol', status: 'opt-unpaid' }),
        doc('ready', 'expenses', { invoiceDate: '2026-09-22', source: 'src-scan', reviewStatus: 'Klaar' }),
    ];
    const sel = selectForExport(docs, { startDate: '2026-09-01', endDate: '2026-09-30', includeAlreadyExported: false });
    assert.deepEqual(sel.toExport.map(d => d.id), ['ok', 'pep']);
    assert.deepEqual(sel.unvalidated.map(d => d.id), ['scan', 'ready']);
});

import { ledgerAccountOf } from '../src/lib/records/accountant-export.ts';
import { COST_TYPES } from '../src/lib/kernel/expense-taxonomy.ts';
import { COST_TYPE_MAR, TICKET_CATEGORY_MAR } from '../src/lib/kernel/expense-taxonomy.ts';

test('MAR-1: the line is booked on the typed account, else the cost type / ticket category account (throw proof: an empty column)', () => {
    assert.equal(ledgerAccountOf('invoice', { costType: 'ct-2-1' }), '603');
    assert.equal(ledgerAccountOf('invoice', { costType: 'ct-2-1', ledgerAccount: '6030010' }), '6030010');   // typed wins
    assert.equal(ledgerAccountOf('ticket', { category: 'cat-fuel' }), '612');
    assert.equal(ledgerAccountOf('invoice', {}), '');                                                      // never a guess
});

test('MAR-1: every cost type and every ticket category has its account (a new type without one fails here)', () => {
    for (const ct of COST_TYPES) assert.ok(COST_TYPE_MAR[ct.id], `cost type ${ct.id} has no MAR account`);
    for (const id of ['cat-fuel', 'cat-restaurant', 'cat-office', 'cat-tools', 'cat-materials', 'cat-parking', 'cat-transport', 'cat-other']) assert.ok(TICKET_CATEGORY_MAR[id], id);
});
