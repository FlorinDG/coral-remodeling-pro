/**
 * DOC-LINES-1 step 4 · the Peppol send says what the editor, the totals and the PDF say. Every line carries a VAT
 * rate (BR-CO-04): the document's rate. The discount on the total goes as a document allowance before VAT. VAT is
 * computed per rate group (BR-S-08/09).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenBlocksToLineItems, peppolFigures, buildPeppolPayload, type InvoiceBlock } from '../src/lib/peppol-payload.ts';
import { generatePeppolUBL } from '../src/lib/peppol-ubl.ts';
import { calculateInvoiceTotals } from '../src/lib/invoice-totals.ts';

let n = 0;
const line = (p: Record<string, unknown>): InvoiceBlock => ({ id: `b${++n}`, type: 'line', content: `Lijn ${n}`, quantity: 1, ...p } as InvoiceBlock);
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

test('every line carries the DOCUMENT rate — a 6% document never goes out at 21%', () => {
    const items = flattenBlocksToLineItems([line({ verkoopPrice: 100 }), line({ verkoopPrice: 50 })], { vatRegime: '6' });
    assert.deepEqual(items.map(i => i.tax_rate), ['6.00', '6.00']);
    const rc = flattenBlocksToLineItems([line({ verkoopPrice: 100 })], { vatRegime: 'medecontractant' });
    assert.equal(rc[0].tax_rate, '0.00');
    assert.equal(rc[0].isReverseCharge, true);
});

test('the send charges what the totals charge — subcomponents, a post × quantity, optional lines left out', () => {
    const blocks = [
        { id: 'p', type: 'post', content: 'Fase', quantity: 2, children: [
            line({ verkoopPrice: 10, quantity: 3 }),
            line({ quantity: 2, children: [line({ verkoopPrice: 4 }), line({ verkoopPrice: 6, quantity: 2 })] }),
        ] } as InvoiceBlock,
        line({ verkoopPrice: 999, isOptional: true }),
    ];
    const items = flattenBlocksToLineItems(blocks, { vatRegime: '21' });
    assert.equal(items.length, 2);
    assert.deepEqual(items.map(i => i.quantity), [6, 4]);         // the line's quantity × the post's
    assert.deepEqual(items.map(i => i.amount), [60, 64]);          // (4 + 12) × 2 × 2
    assert.equal(sum(items.map(i => i.amount)), calculateInvoiceTotals(blocks, { vatRegime: '21' }).subtotal);
});

test('a line discount: the line goes out at its NET price (BT-146), amount = net', () => {
    const [i] = flattenBlocksToLineItems([line({ verkoopPrice: 100, quantity: 3, clientDiscount: { kind: 'pct', value: 10 } })], { vatRegime: '21' });
    assert.equal(i.amount, 270);
    assert.equal(i.unit_price, 90);
    const [j] = flattenBlocksToLineItems([line({ verkoopPrice: 10, quantity: 3, clientDiscount: { kind: 'amount', value: 1 } })], { vatRegime: '21' });
    assert.equal(j.amount, 29);
    assert.equal(j.unit_price, 9.6667);                            // 4 decimals allowed for unit_price
});

test('prices entered incl. VAT go out excl. VAT', () => {
    const [i] = flattenBlocksToLineItems([line({ verkoopPrice: 121 })], { vatRegime: '21', vatIncluded: true });
    assert.equal(i.amount, 100);
});

test('the discount on the total: one allowance per rate, code 95 — and the totals agree', () => {
    const blocks = [line({ verkoopPrice: 333.33 }), line({ verkoopPrice: 66.66, clientDiscount: { kind: 'pct', value: 50 } })];
    const discount = { kind: 'pct' as const, value: 10 };
    const { items, allowances, totals } = peppolFigures(blocks, { vatRegime: '6', documentDiscount: discount });
    assert.equal(allowances.length, 1);
    assert.equal(allowances[0].reason_code, '95');
    assert.equal(allowances[0].tax_rate, '6.00');
    assert.equal(allowances[0].tax_code, 'S');
    assert.equal(allowances[0].amount, totals.documentDiscount);
    assert.equal(sum(items.map(i => i.amount)) - allowances[0].amount, totals.subtotal);

    assert.deepEqual(peppolFigures(blocks, { vatRegime: '6' }).allowances, []);
    assert.equal(peppolFigures(blocks, { vatRegime: 'medecontractant', documentDiscount: discount }).allowances[0].tax_code, 'AE');
});

test('DOC-LINES-2 · mixed rates: each line its own rate and VAT; the discount split per rate; lines + allowances = the totals', () => {
    const blocks = [line({ verkoopPrice: 2.25, quantity: 1 }), line({ verkoopPrice: 2.25 }), line({ verkoopPrice: 2.25 }), line({ verkoopPrice: 2.25 }),
        line({ verkoopPrice: 100, vatRate: 6 })];
    const { items, allowances, totals } = peppolFigures(blocks, { vatRegime: '21', documentDiscount: { kind: 'amount', value: 10 } });
    assert.deepEqual(items.map(i => i.tax_rate), ['21.00', '21.00', '21.00', '21.00', '6.00']);
    assert.deepEqual(items.map(i => i.tax), [0.47, 0.47, 0.47, 0.47, 6]);         // rounded at the line
    assert.deepEqual(allowances.map(a => a.tax_rate).sort(), ['21.00', '6.00']);
    assert.equal(sum(allowances.map(a => a.amount)), 10);
    for (const v of totals.vatBreakdown) {
        const lines = sum(items.filter(i => parseFloat(i.tax_rate) === v.rate).map(i => i.amount));
        const off = sum(allowances.filter(a => parseFloat(a.tax_rate) === v.rate).map(a => a.amount));
        assert.equal(Math.round((lines - off) * 100) / 100, v.base);                // BR-S-08, to the cent
        assert.ok(Math.abs(v.vat - v.base * v.rate / 100) < 1);                      // BR-S-09 tolerance
    }
});

test('the payload carries the allowance — never as total_discount (that is the NON-VAT discount)', () => {
    const { invoicePayload } = buildPeppolPayload({
        invoiceId: 'x', invoiceTitle: 'F-1', client: { companyName: 'Klant' },
        blocks: [line({ verkoopPrice: 200 })], vatRegime: '21', documentDiscount: { kind: 'amount', value: 20 },
        tenant: { companyName: 'Coral', vatNumber: 'BE0123456789', street: null, postalCode: null, city: null, email: null, iban: null, bic: null },
    });
    assert.equal(invoicePayload.allowances.length, 1);
    assert.equal(invoicePayload.allowances[0].amount, 20);
    assert.equal(invoicePayload.total_discount, undefined);
    assert.equal(invoicePayload.subtotal, 180);
    assert.equal(invoicePayload.total_tax, 37.8);
    assert.equal(invoicePayload.invoice_total, 217.8);
    assert.deepEqual(invoicePayload.tax_details, [{ rate: '21.00', amount: 37.8 }]);
    const none = buildPeppolPayload({
        invoiceId: 'x', invoiceTitle: 'F-2', client: { companyName: 'Klant' }, blocks: [line({ verkoopPrice: 200 })], vatRegime: '21',
        tenant: { companyName: 'Coral', vatNumber: 'BE0123456789', street: null, postalCode: null, city: null, email: null, iban: null, bic: null },
    });
    assert.equal(none.invoicePayload.allowances, undefined);
});

test('the UBL (manual path): allowance lowers the taxable amount; VAT per rate on what remains; totals match the PDF', () => {
    const blocks = [line({ verkoopPrice: 123.45, quantity: 3 }), line({ verkoopPrice: 10.01 })];
    const discount = { kind: 'pct' as const, value: 7 };
    const { items, allowances, totals } = peppolFigures(blocks, { vatRegime: '21', documentDiscount: discount });
    const xml = generatePeppolUBL({
        invoiceId: 'F-1', issueDate: '2026-10-09', dueDate: '2026-11-08', currency: 'EUR',
        supplierName: 'Coral', supplierVatNumber: 'BE0123456789', supplierCountry: 'BE', customerName: 'Klant',
        items: items.map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unit_price, lineTotal: i.amount, taxRate: parseFloat(i.tax_rate) })),
        allowances: allowances.map(a => ({ amount: a.amount, taxRate: parseFloat(a.tax_rate), reason: a.reason })),
        taxSubtotals: totals.vatBreakdown.map(v => ({ rate: v.rate, taxableAmount: v.base, taxAmount: v.vat })),
    });
    const t = calculateInvoiceTotals(blocks, { vatRegime: '21', documentDiscount: discount });
    const tag = (name: string) => xml.match(new RegExp(`<cbc:${name} [^>]*>([^<]+)<`))![1];
    assert.equal(tag('TaxExclusiveAmount'), t.subtotal.toFixed(2));
    assert.equal(tag('TaxableAmount'), t.subtotal.toFixed(2));
    assert.equal(tag('AllowanceTotalAmount'), t.documentDiscount.toFixed(2));
    assert.equal(tag('PayableAmount'), t.totalInclVAT.toFixed(2));
    assert.equal(xml.match(/<cac:TaxTotal>\s*<cbc:TaxAmount [^>]*>([^<]+)</)![1], t.totalVAT.toFixed(2));
    assert.match(xml, /<cbc:AllowanceChargeReasonCode>95</);
});

test('a credit note is known by its docType — no screen reads a property "isCreditNote" (nothing writes it)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/components/admin/invoices/ClientInvoiceEngine.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /properties\?*\.?\[['"]isCreditNote['"]\]/);
    assert.match(src, /const isCreditNote = String\(invoice\.properties\?\.\['docType'\]\) === 'opt-credit-note'/);
});
