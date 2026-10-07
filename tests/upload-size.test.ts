import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetSize, shouldShrink, MAX_UPLOAD_BYTES } from '../src/lib/files/upload-size.ts';

test('a phone photo is shrunk to a readable size that travels (throw proof: a 6 MB 4032×3024 photo sent as is)', () => {
    assert.equal(shouldShrink('image/jpeg', 6_000_000), true);
    assert.deepEqual(targetSize(4032, 3024), { width: 2000, height: 1500 });
    assert.deepEqual(targetSize(3024, 4032), { width: 1500, height: 2000 });   // portrait stays portrait
    assert.deepEqual(targetSize(1200, 900), { width: 1200, height: 900 });     // never enlarged
});

test('small photos and PDFs travel as they are; the cap stays under the platform limit', () => {
    assert.equal(shouldShrink('image/jpeg', 800_000, 1600, 1200), false);
    assert.equal(shouldShrink('application/pdf', 9_000_000), false);
    assert.equal(shouldShrink('image/heic', 9_000_000), false);   // HEIC is refused by the reader rules, not re-encoded
    assert.ok(MAX_UPLOAD_BYTES < 4_500_000);
});
