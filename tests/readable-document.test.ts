import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readableDocument } from '../src/lib/records/readable-document.ts';

const bytes = (...parts: Array<number[] | string>) => {
    const out: number[] = [];
    for (const p of parts) out.push(...(typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p));
    while (out.length < 16) out.push(0);
    return new Uint8Array(out);
};

test('the real format, from the first bytes (throw proof: a HEIC photo sent as JPEG and read as nothing)', () => {
    assert.deepEqual(readableDocument(bytes('%PDF-1.7')), { ok: true, kind: 'pdf' });
    assert.deepEqual(readableDocument(bytes([0xff, 0xd8, 0xff, 0xe0])), { ok: true, kind: 'image', mime: 'image/jpeg' });
    assert.deepEqual(readableDocument(bytes([0x89], 'PNG')), { ok: true, kind: 'image', mime: 'image/png' });
    assert.deepEqual(readableDocument(bytes('RIFF', [0, 0, 0, 0], 'WEBP')), { ok: true, kind: 'image', mime: 'image/webp' });
    assert.deepEqual(readableDocument(bytes([0, 0, 0, 0x18], 'ftypheic')), { ok: false, reason: 'heic' });
    assert.deepEqual(readableDocument(bytes([0, 0, 0, 0x18], 'ftypmif1')), { ok: false, reason: 'heic' });
    assert.deepEqual(readableDocument(bytes('II*', [0])), { ok: false, reason: 'unsupported' });   // TIFF
    assert.deepEqual(readableDocument(new Uint8Array(3)), { ok: false, reason: 'empty' });
});
