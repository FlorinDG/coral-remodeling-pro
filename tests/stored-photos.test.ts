import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoredPhotos, resolveFileUrl } from '../src/lib/files.ts';

test('ClockEntry.photos — every shape production holds', () => {
    assert.deepEqual(normalizeStoredPhotos(null), []);
    assert.deepEqual(normalizeStoredPhotos({}), []);
    assert.deepEqual(normalizeStoredPhotos(['t_abc/hr/x/p1.jpg']).map(p => p.key), ['t_abc/hr/x/p1.jpg']);
    assert.equal(normalizeStoredPhotos(['t_abc/hr/x/p1.jpg'])[0].name, 'p1.jpg');
    assert.deepEqual(normalizeStoredPhotos([{ url: 'https://b/x.png', name: 'X' }]), [{ key: 'https://b/x.png', name: 'X', type: 'image/jpeg' }]);
    assert.deepEqual(normalizeStoredPhotos(JSON.stringify(['t_a/b.jpg'])).map(p => p.key), ['t_a/b.jpg']);
    assert.deepEqual(normalizeStoredPhotos('t_single/key.jpg').map(p => p.key), ['t_single/key.jpg']);
    assert.deepEqual(normalizeStoredPhotos(['', null, 3, { name: 'no key' }]), []);
});

test('a stored key resolves through the authenticated file route', () => {
    assert.equal(resolveFileUrl('t_abc/hr/x/p1.jpg'), '/api/files/t_abc/hr/x/p1.jpg');
});
