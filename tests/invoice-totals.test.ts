/**
 * CHARACTERIZATION TESTS — calculateInvoiceTotals  (src/lib/invoice-totals.ts)
 *
 * This is the money path. These tests pin CURRENT behaviour so a refactor
 * (e.g. the DnD engine rebuild) cannot silently change a client-facing total.
 *
 * RULES OF USE:
 *  - A failure means behaviour CHANGED. Decide deliberately whether that was intended.
 *  - Never edit a test to make it green. Either the code is wrong, or the change was
 *    intentional and the test is updated in the same commit, on purpose.
 */
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculateInvoiceTotals } from '../src/lib/invoice-totals.ts';

// Minimal block factory — only the fields the calculator reads.
const line = (over: Record<string, unknown> = {}) => ({
    id: Math.random().toString(36).slice(2),
    type: 'line',
    quantity: 1,
    verkoopPrice: 100,
    ...over,
}) as never;

const container = (type: string, children: unknown[], over: Record<string, unknown> = {}) => ({
    id: Math.random().toString(36).slice(2),
    type,
    quantity: 1,
    children,
    ...over,
}) as never;

describe('VAT regimes (Belgian construction)', () => {
    test('21% standard', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 1000 })], { vatRegime: '21' });
        assert.equal(t.subtotal, 1000);
        assert.equal(t.totalVAT, 210);
        assert.equal(t.totalInclVAT, 1210);
        assert.equal(t.hasMedecontractant, false);
    });

    test('6% renovation rate', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 1000 })], { vatRegime: '6' });
        assert.equal(t.totalVAT, 60);
        assert.equal(t.totalInclVAT, 1060);
    });

    test('medecontractant → 0% VAT and the flag is set', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 1000 })], { vatRegime: 'medecontractant' });
        assert.equal(t.subtotal, 1000);
        assert.equal(t.totalVAT, 0);
        assert.equal(t.totalInclVAT, 1000);
        assert.equal(t.hasMedecontractant, true);
        assert.equal(t.vatBreakdown[0].rate, 0);
        assert.equal(t.vatBreakdown[0].isMedecontractant, true);
    });

    test('output VAT is UNIFORM — one rate group per document, never mixed', () => {
        // Belgian rule: materials follow the works rate ("bijzaak volgt hoofdzaak").
        const t = calculateInvoiceTotals(
            [line({ verkoopPrice: 500 }), line({ verkoopPrice: 300 }), line({ verkoopPrice: 200 })],
            { vatRegime: '6' },
        );
        assert.equal(t.vatBreakdown.length, 1, 'a sales invoice must produce exactly one VAT group');
        assert.equal(t.vatBreakdown[0].rate, 6);
        assert.equal(t.subtotal, 1000);
        assert.equal(t.totalVAT, 60);
    });

    test('defaults to 21% when no regime is supplied', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 100 })]);
        assert.equal(t.totalVAT, 21);
    });
});

describe('price resolution', () => {
    test('unitPrice overrides verkoopPrice (invoice-specific price wins)', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 100, unitPrice: 80 })], { vatRegime: '21' });
        assert.equal(t.subtotal, 80);
    });

    test('unitPrice of 0 still overrides — a deliberate zero is not "missing"', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 100, unitPrice: 0 })], { vatRegime: '21' });
        assert.equal(t.subtotal, 0);
    });

    test('missing price counts as 0, not NaN', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: undefined })], { vatRegime: '21' });
        assert.equal(t.subtotal, 0);
        assert.ok(!Number.isNaN(t.totalInclVAT));
    });
});

describe('quantity and nesting', () => {
    test('quantity multiplies the line', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 50, quantity: 4 })], { vatRegime: '21' });
        assert.equal(t.subtotal, 200);
    });

    test('a container contributes nothing itself — only its children count', () => {
        const t = calculateInvoiceTotals(
            [container('section', [line({ verkoopPrice: 100 }), line({ verkoopPrice: 200 })])],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 300);
    });

    test('post quantity multiplies its children (nested multiplier)', () => {
        const t = calculateInvoiceTotals(
            [container('post', [line({ verkoopPrice: 100 })], { quantity: 3 })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 300);
    });

    test('multipliers compound through two levels', () => {
        const t = calculateInvoiceTotals(
            [container('post', [line({ verkoopPrice: 10, quantity: 2 })], { quantity: 5 })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 100); // 10 * 2 * 5
    });

    test('deep nesting: section > subsection > post > line', () => {
        const t = calculateInvoiceTotals(
            [container('section', [
                container('subsection', [
                    container('post', [line({ verkoopPrice: 25, quantity: 2 })], { quantity: 2 }),
                ]),
            ])],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 100);
    });
});

describe('optional lines', () => {
    test('isOptional lines are excluded from the total', () => {
        const t = calculateInvoiceTotals(
            [line({ verkoopPrice: 100 }), line({ verkoopPrice: 999, isOptional: true })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 100);
    });

    test('an optional CONTAINER excludes everything beneath it', () => {
        const t = calculateInvoiceTotals(
            [container('section', [line({ verkoopPrice: 500 })], { isOptional: true })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 0);
    });
});

describe('VAT-inclusive pricing (prices entered incl. VAT)', () => {
    test('21% incl → base is back-calculated', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 121 })], { vatRegime: '21', vatIncluded: true });
        assert.equal(t.subtotal, 100);
        assert.equal(t.totalVAT, 21);
        assert.equal(t.totalInclVAT, 121);
    });

    test('6% incl → base is back-calculated', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 106 })], { vatRegime: '6', vatIncluded: true });
        assert.equal(t.subtotal, 100);
        assert.equal(t.totalVAT, 6);
        assert.equal(t.totalInclVAT, 106);
    });
});

describe('rounding — where cents are won and lost', () => {
    test('subtotal is rounded to 2 decimals', () => {
        const t = calculateInvoiceTotals([line({ verkoopPrice: 0.005 })], { vatRegime: '21' });
        assert.equal(t.subtotal, 0.01);
    });

    test('VAT is rounded per rate-group, then totalled (not rounded per line)', () => {
        const t = calculateInvoiceTotals(
            [line({ verkoopPrice: 33.33 }), line({ verkoopPrice: 33.33 }), line({ verkoopPrice: 33.34 })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 100);
        assert.equal(t.totalVAT, 21);
        assert.equal(t.totalInclVAT, 121);
    });

    test('total incl VAT always equals rounded(subtotal) + rounded(VAT)', () => {
        const t = calculateInvoiceTotals(
            [line({ verkoopPrice: 19.99, quantity: 3 }), line({ verkoopPrice: 5.55 })],
            { vatRegime: '21' },
        );
        assert.equal(
            t.totalInclVAT,
            Math.round((t.subtotal + t.totalVAT) * 100) / 100,
            'the invoice total must reconcile with its own subtotal and VAT',
        );
    });
});

describe('empty and degenerate documents', () => {
    test('no blocks → all zeroes, no VAT groups', () => {
        const t = calculateInvoiceTotals([], { vatRegime: '21' });
        assert.equal(t.subtotal, 0);
        assert.equal(t.totalVAT, 0);
        assert.equal(t.totalInclVAT, 0);
        assert.deepEqual(t.vatBreakdown, []);
    });

    test('text/spacer blocks contribute nothing', () => {
        const t = calculateInvoiceTotals(
            [{ id: 'x', type: 'text' } as never, { id: 'y', type: 'space' } as never, line({ verkoopPrice: 10 })],
            { vatRegime: '21' },
        );
        assert.equal(t.subtotal, 10);
    });
});
