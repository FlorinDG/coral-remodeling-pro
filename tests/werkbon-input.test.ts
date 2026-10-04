import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentLanguage, addressLine, linesFromEvidence } from '../src/lib/records/werkbon-input.ts';

test('the order giver\'s language decides the document language; unset → Dutch', () => {
    assert.equal(documentLanguage({ language: 'lang-fr' }), 'fr');
    assert.equal(documentLanguage({ language: 'lang-en' }), 'en');
    assert.equal(documentLanguage({ language: 'lang-nl' }), 'nl');
    assert.equal(documentLanguage({}), 'nl');
    assert.equal(documentLanguage(null), 'nl');
});

test('address: street + postal city; else the location field; else null', () => {
    assert.equal(addressLine({ address: 'Kerkstraat 1', postal: '9000', city: 'Gent' }), 'Kerkstraat 1, 9000 Gent');
    assert.equal(addressLine({ location: { address: 'Werf 2, 2000 Antwerpen' } }), 'Werf 2, 2000 Antwerpen');
    assert.equal(addressLine({ 'prop-location': 'Dok 3' }), 'Dok 3');
    assert.equal(addressLine({}), null);
});

test('lines: Brussels wall-clock times (summer: UTC+2), the minutes frozen at signing, open entries left out', () => {
    const lines = linesFromEvidence([
        { userId: 'u1', in: '2026-07-01T06:00:00.000Z', out: '2026-07-01T14:30:00.000Z', minutes: 480 },
        { userId: 'u2', in: '2026-07-01T06:00:00.000Z', out: null, minutes: 0 },
    ], id => (id === 'u1' ? 'Andrei' : '?'));
    assert.deepEqual(lines, [{ workerName: 'Andrei', in: '08:00', out: '16:30', minutes: 480 }]);
});

test('winter time (UTC+1) is handled by the kernel, not by offset arithmetic', () => {
    const [l] = linesFromEvidence([{ userId: 'u1', in: '2026-01-15T07:00:00.000Z', out: '2026-01-15T11:00:00.000Z', minutes: 240 }], () => 'X');
    assert.equal(l.in, '08:00');
    assert.equal(l.out, '12:00');
});
