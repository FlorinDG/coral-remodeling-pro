/**
 * EDITOR-1 · E1–E3: rich text complies with the ERP's rules — one allowlist (core), enforced at the record door,
 * and by every portal render. Plus the PDF reader prints TipTap's list shape.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeRichText, sanitizeBlocks, richTextRuns } from '../src/lib/records/rich-text.ts';
import { applyRecordIntent } from '../src/lib/records/record-intent.ts';

test('E1 · the allowlist keeps what a document prints and strips everything else', () => {
    assert.equal(sanitizeRichText('<p><strong>Vloer</strong> <em>eik</em> <u>geolied</u></p>'), '<p><strong>Vloer</strong> <em>eik</em> <u>geolied</u></p>');
    assert.equal(sanitizeRichText('<ul><li><p>a</p></li></ul><ol><li>b</li></ol>'), '<ul><li><p>a</p></li></ul><ol><li>b</li></ol>');
    assert.equal(sanitizeRichText('Plain 10 m² & more'), 'Plain 10 m² & more');
    // scripts and handlers
    assert.equal(sanitizeRichText('a<script>alert(1)</script>b'), 'ab');
    assert.equal(sanitizeRichText('<img src=x onerror="alert(1)">x'), 'x');
    assert.equal(sanitizeRichText('<p onclick="steal()">x</p>'), '<p>x</p>');
    assert.equal(sanitizeRichText('<a href="javascript:alert(1)">klik</a>'), 'klik');
    assert.equal(sanitizeRichText('<iframe src="https://evil"></iframe>ok'), 'ok');
    assert.equal(sanitizeRichText('<svg><script>x</script></svg>ok'), 'ok');
    assert.equal(sanitizeRichText('<span style="color: red; background: url(javascript:x)">r</span>'), '<span style="color: red">r</span>');
    assert.equal(sanitizeRichText('<span style="color: expression(alert(1))">r</span>'), '<span>r</span>');
    assert.equal(sanitizeRichText('<font color="#ff0000">r</font>'), '<span style="color: #ff0000">r</span>');
    // broken markup can't smuggle a tag through
    assert.equal(sanitizeRichText('<img src=x onerror=alert(1)'), '&lt;img src=x onerror=alert(1)');
    assert.equal(sanitizeRichText('<span title="a>b" onclick=x>t</span>'), '<span>b" onclick=x&gt;t</span>');
});

test('E1 · a block tree: every content reduced, children too; a media block keeps its URL', () => {
    const out = sanitizeBlocks([
        { type: 'line', content: '<b>x</b><script>y</script>', children: [{ type: 'line', content: '<img onerror=z>k' }] },
        { type: 'image', content: 'https://cdn.example/a.png' },
    ]);
    assert.equal(out[0].content, '<b>x</b>');
    assert.equal(out[0].children[0].content, 'k');
    assert.equal(out[1].content, 'https://cdn.example/a.png');
});

test('E2 · the record door stores only the allowlist — whatever wrote the blocks', () => {
    const r = applyRecordIntent(
        { properties: {}, blocks: [{ type: 'line', content: 'old' }], blocksVersion: 1, updatedAt: '2026-10-09T00:00:00.000Z' },
        { pageId: 'p', fields: {}, blocks: [{ type: 'line', content: 'new<script>steal()</script>' }], baseBlocksVersion: 1 } as never,
        { dbProperties: [] } as never,
    );
    assert.equal(r.ok, true);
    assert.equal((r as { blocks: Array<{ content: string }> }).blocks[0].content, 'new');
});

test('E3 · the portal viewers (seen by the tenant\'s customers) render only sanitized text', () => {
    for (const f of ['../src/app/[locale]/quote/[id]/QuotationViewer.tsx', '../src/app/[locale]/invoice/[id]/InvoiceViewer.tsx']) {
        const src = readFileSync(new URL(f, import.meta.url), 'utf8');
        assert.doesNotMatch(src, /__html:\s*block\.content/, f);
        assert.match(src, /__html:\s*sanitizeRichText\(block\.content\)/, f);
    }
    // The editors render no raw HTML at all — the text goes through the ONE rich-text field (EDITOR-1 E6)
    for (const f of ['../src/components/admin/invoices/InvoiceRow.tsx', '../src/components/admin/quotations/QuotationRow.tsx']) {
        const src = readFileSync(new URL(f, import.meta.url), 'utf8');
        assert.doesNotMatch(src, /__html:\s*(sanitizeRichText\()?block\.content/, f);
        assert.match(src, /<RichText\b/, f);
    }
});

const flat = (html: string) => richTextRuns(html).map(r => 'newline' in r ? '\n' : r.text).join('');

test('the ONE reader (core) puts a TipTap list item (<li><p>…</p></li>) on the bullet\'s line', () => {
    assert.equal(flat('<ul><li><p>eerste</p></li><li><p>tweede</p></li></ul>'), '• eerste\n• tweede');
    assert.equal(flat('<ol><li>a</li><li>b</li></ol>'), '1. a\n2. b');
    assert.equal(flat('<p>één</p><p>twee</p>'), 'één\ntwee');
    assert.equal(flat('a<br>b &amp; c'), 'a\nb & c');
    const [run] = richTextRuns('<strong><span style="color: #f00">x</span></strong>');
    assert.deepEqual(run, { text: 'x', bold: true, color: '#f00' });
    assert.equal(flat('ok<script>bad()</script>'), 'ok');                 // a legacy row prints only the allowlist
});

test('the PDF renders runs only — it parses no HTML itself', () => {
    const src = readFileSync(new URL('../src/components/admin/shared/pdfRichText.tsx', import.meta.url), 'utf8');
    assert.match(src, /richTextRuns\(/);
    assert.doesNotMatch(src, /split\(|RegExp|match\(/);
});
