import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildWorkOrderView,
    renderSignedWorkOrderPdf,
    SignedWorkOrderValidationError,
} from '../src/lib/documents/work-order-pdf.ts';
import type { SignedWorkOrderPdfInput } from '../src/lib/documents/work-order-pdf.ts';

// 1x1 transparent PNG for signature fixture
const SAMPLE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

function makeValidInput(overrides: Partial<SignedWorkOrderPdfInput> = {}): SignedWorkOrderPdfInput {
    return {
        tenant: {
            name: 'Coral Remodeling BV',
            vatNumber: 'BE 0123.456.789',
            address: 'Boulevard Anspach 1, 1000 Brussel',
            brandColor: '#ea580c',
            logoPng: null,
        },
        client: {
            name: 'Immo Residentie',
            address: 'Kerkstraat 10, 9000 Gent',
        },
        workOrder: {
            reference: 'WO-2026-0042',
            date: '2026-10-02',
            siteAddress: 'Kerkstraat 10, 9000 Gent',
            projectName: 'Residentie Renovatie',
        },
        lines: [
            { workerName: 'Jan Janssens', in: '08:00', out: '16:00', minutes: 450 },
            { workerName: 'Piet Pieters', in: '08:00', out: '12:00', minutes: 240 },
        ],
        tasks: [
            { title: 'Wandisolatie geplaatst', done: true },
            { title: 'Plafond afgewerkt', done: false },
        ],
        description: 'Vervanging van gyproc platen volgens offerte #12.',
        crewNotes: [
            { workerName: 'Jan Janssens', note: 'Afvalcontainer vol, nieuwe besteld.' },
        ],
        signature: {
            signerName: 'Jean Dupont',
            signedAt: '2026-10-02T14:45:00Z', // 16:45 in Europe/Brussels
            imagePng: SAMPLE_PNG,
        },
        language: 'nl',
        ...overrides,
    };
}

// ── 1. VALIDATION THROWS ────────────────────────────────────────────────────────

test('throws SignedWorkOrderValidationError on empty or whitespace signerName', () => {
    const inputMissing = makeValidInput({
        signature: {
            signerName: '   ',
            signedAt: '2026-10-02T14:45:00Z',
            imagePng: SAMPLE_PNG,
        },
    });
    assert.throws(
        () => buildWorkOrderView(inputMissing),
        (err: unknown) => err instanceof SignedWorkOrderValidationError && /signer/i.test(err.message)
    );
});

test('throws SignedWorkOrderValidationError on empty signature imagePng', () => {
    const inputEmptySig = makeValidInput({
        signature: {
            signerName: 'Jean Dupont',
            signedAt: '2026-10-02T14:45:00Z',
            imagePng: Buffer.alloc(0),
        },
    });
    assert.throws(
        () => buildWorkOrderView(inputEmptySig),
        (err: unknown) => err instanceof SignedWorkOrderValidationError && /signature/i.test(err.message)
    );
});

test('throws SignedWorkOrderValidationError on zero lines', () => {
    const inputNoLines = makeValidInput({ lines: [] });
    assert.throws(
        () => buildWorkOrderView(inputNoLines),
        (err: unknown) => err instanceof SignedWorkOrderValidationError && /line/i.test(err.message)
    );
});

// ── 2. BRUSSELS TIMEZONE FORMATTING (C2) ────────────────────────────────────────

test('formats signature timestamp strictly in Europe/Brussels wall-clock time', () => {
    // 14:45 UTC on 2026-10-02 is 16:45 CEST (UTC+2) in Brussels
    const input = makeValidInput({
        signature: {
            signerName: 'Jean Dupont',
            signedAt: '2026-10-02T14:45:00Z',
            imagePng: SAMPLE_PNG,
        },
    });
    const view = buildWorkOrderView(input);
    assert.equal(view.signature.signedAtFormatted, '02/10/2026 16:45');
});

// ── 3. VIEW MODEL & DURATION CALCULATION (C1) ──────────────────────────────────

test('formats line duration as "7,50 u (07:30)" and total from summed minutes', () => {
    // 3 lines of 20 minutes each = 60 minutes total -> exactly 1,00 u (01:00)
    const input = makeValidInput({
        language: 'nl',
        lines: [
            { workerName: 'A', in: '08:00', out: '08:20', minutes: 20 },
            { workerName: 'B', in: '08:20', out: '08:40', minutes: 20 },
            { workerName: 'C', in: '08:40', out: '09:00', minutes: 20 },
        ],
    });
    const view = buildWorkOrderView(input);

    assert.equal(view.lines[0].formattedDuration, '0,33 u (00:20)');
    assert.equal(view.lines[1].formattedDuration, '0,33 u (00:20)');
    assert.equal(view.lines[2].formattedDuration, '0,33 u (00:20)');

    // Total must be computed from SUMMED MINUTES (60 min = 1,00 u), never 0,33 + 0,33 + 0,33 = 0,99
    assert.equal(view.totals.totalMinutes, 60);
    assert.equal(view.totals.formattedDuration, '1,00 u (01:00)');
});

test('language changes labels and unit between nl and fr', () => {
    const viewNl = buildWorkOrderView(makeValidInput({ language: 'nl' }));
    const viewFr = buildWorkOrderView(makeValidInput({ language: 'fr' }));

    assert.equal(viewNl.labels.title, 'WERKBON');
    assert.equal(viewNl.labels.unit, 'u');
    assert.match(viewNl.lines[0].formattedDuration, /\bu\b/);

    assert.equal(viewFr.labels.title, 'BON DE TRAVAIL');
    assert.equal(viewFr.labels.unit, 'h');
    assert.match(viewFr.lines[0].formattedDuration, /\bh\b/);
});

test('carries description and crew notes verbatim without truncation', () => {
    const desc = 'Special instructions: client requested extra attention on the corner joint.';
    const note = 'Work completed as agreed; site left clean.';
    const input = makeValidInput({
        description: desc,
        crewNotes: [{ workerName: 'Piet Pieters', note }],
    });
    const view = buildWorkOrderView(input);

    assert.equal(view.description, desc);
    assert.equal(view.crewNotes.length, 1);
    assert.equal(view.crewNotes[0].workerName, 'Piet Pieters');
    assert.equal(view.crewNotes[0].note, note);
});

test('carries Romanian and Cyrillic names through unchanged (C4)', () => {
    const input = makeValidInput({
        client: { name: 'Дмитрий Иванов', address: null },
        lines: [
            { workerName: 'Ștefan Țurcanu', in: '08:00', out: '16:00', minutes: 480 },
        ],
    });
    const view = buildWorkOrderView(input);

    assert.equal(view.client?.name, 'Дмитрий Иванов');
    assert.equal(view.lines[0].workerName, 'Ștefan Țurcanu');
});

test('view model never leaks internal cost rates, prices, or user ids', () => {
    const input = makeValidInput();
    const serialized = JSON.stringify(buildWorkOrderView(input));

    assert.doesNotMatch(serialized, /costRate/i);
    assert.doesNotMatch(serialized, /hourlyRate/i);
    assert.doesNotMatch(serialized, /adminNotes/i);
    assert.doesNotMatch(serialized, /cuid/i);
});

// ── 4. REAL RENDERER: %PDF MAGIC BYTES (C1) ────────────────────────────────────

test('renderSignedWorkOrderPdf returns a Buffer starting with %PDF', async () => {
    const input = makeValidInput();
    const buf = await renderSignedWorkOrderPdf(input);

    assert.ok(Buffer.isBuffer(buf), 'result must be a Buffer');
    assert.ok(buf.length > 500, 'buffer must contain meaningful PDF data');
    assert.equal(buf.subarray(0, 4).toString('utf-8'), '%PDF');
});

// ── 5. REAL RENDERER: DETERMINISM (C1) ──────────────────────────────────────────

test('renderSignedWorkOrderPdf is deterministic: same input produces identical bytes', async () => {
    const input = makeValidInput();
    const buf1 = await renderSignedWorkOrderPdf(input);
    const buf2 = await renderSignedWorkOrderPdf(input);

    assert.equal(Buffer.compare(buf1, buf2), 0, 'two renders with identical input must produce identical bytes');
});
