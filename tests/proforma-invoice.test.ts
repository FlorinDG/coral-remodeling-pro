import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceFromProforma, invoiceOfProforma } from '../src/lib/records/proforma-invoice.ts';

const proforma = {
    id: 'pf-1',
    properties: {
        title: 'Proforma', docType: 'opt-proforma', status: 'opt-sent', client: ['c-1'], betreft: 'Badkamer',
        project: ['p-1'], quote: ['q-1'], 'prop-payment-method': 'pay-14', deliveryDate: '2026-10-01',
        totalExVat: 1000, totalVat: 210, totalIncVat: 1210,
        invoiceDate: '2026-10-02', dueDate: '2026-10-16', structuredComm: '+++123/4567/89012+++',
        sentAt: '2026-10-02T09:00:00.000Z', accountantExportedAt: true, peppolStatus: 'x', comments: 'z',
        'prop-klantref': 'PO-77',
    },
    blocks: [{ id: 'b1', type: 'financial-row', content: 'Tegels', children: [{ id: 'b2', content: 'Voeg' }] }],
};
let n = 0;
const newId = () => `new-${++n}`;

test('a proforma becomes a NEW draft invoice with its own number, linked back (throw proof: the OGM / "sent" carried)', () => {
    const r = invoiceFromProforma(proforma, { number: 'F-2026-014', newId });
    assert.ok(r.ok);
    assert.deepEqual(r.properties, {
        client: ['c-1'], betreft: 'Badkamer', project: ['p-1'], quote: ['q-1'], 'prop-payment-method': 'pay-14',
        deliveryDate: '2026-10-01', totalExVat: 1000, totalVat: 210, totalIncVat: 1210, 'prop-klantref': 'PO-77',
        title: 'F-2026-014', docType: 'opt-invoice', status: 'opt-draft', proforma: ['pf-1'],
    });
    // lines copied with FRESH ids (children too); the proforma's lines untouched
    const b = r.blocks as Array<{ id: string; children: Array<{ id: string }> }>;
    assert.notEqual(b[0].id, 'b1');
    assert.notEqual(b[0].children[0].id, 'b2');
    assert.equal(proforma.blocks[0].id, 'b1');
});

test('only a proforma, only with a number (throw proof: an invoice "converted" without a number — hidden by the filters)', () => {
    assert.deepEqual(invoiceFromProforma({ ...proforma, properties: { ...proforma.properties, docType: 'opt-invoice' } }, { number: 'F-1', newId }), { ok: false, reason: 'not_a_proforma' });
    assert.deepEqual(invoiceFromProforma(proforma, { number: ' ', newId }), { ok: false, reason: 'no_number' });
});

test('the invoice of a proforma is found by its link', () => {
    const pages = [{ id: 'i-1', properties: { proforma: ['pf-0'] } }, { id: 'i-2', properties: { proforma: ['pf-1'] } }];
    assert.equal(invoiceOfProforma(pages, 'pf-1')?.id, 'i-2');
    assert.equal(invoiceOfProforma(pages, 'pf-9'), null);
});
