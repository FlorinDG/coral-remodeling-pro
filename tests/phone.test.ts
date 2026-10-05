import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhone, isEmailAddress } from '../src/lib/records/phone.ts';

test('Belgian numbers are grouped the Belgian way; the form typed is kept (throw proof: a mobile grouped as a landline)', () => {
    assert.equal(formatPhone('0470123456'), '0470 12 34 56');
    assert.equal(formatPhone('0470/12.34.56'), '0470 12 34 56');
    assert.equal(formatPhone('+32470123456'), '+32 470 12 34 56');
    assert.equal(formatPhone('0032 (0)470 12 34 56'.replace('(0)', '')), '+32 470 12 34 56');
    assert.equal(formatPhone('+32 (0)2 123 45 67'), '+32 2 123 45 67');
    assert.equal(formatPhone('021234567'), '02 123 45 67');
    assert.equal(formatPhone('041234567'), '04 123 45 67');      // Liège landline, not a mobile
    assert.equal(formatPhone('050123456'), '050 12 34 56');
    assert.equal(formatPhone('+32 50 12 34 56'), '+32 50 12 34 56');
});

test('not Belgian, or not a number: kept as typed', () => {
    assert.equal(formatPhone(' +31 6 12345678 '), '+31 6 12345678');
    assert.equal(formatPhone('bel na 17u'), 'bel na 17u');
    assert.equal(formatPhone('0470'), '0470');
    assert.equal(formatPhone(''), '');
});

test('email: a real address or empty (throw proof: "jan@" accepted)', () => {
    assert.equal(isEmailAddress('jan@coral-group.be'), true);
    assert.equal(isEmailAddress('j.peeters@mail.example.co.uk'), true);
    assert.equal(isEmailAddress(''), true);
    assert.equal(isEmailAddress('jan@'), false);
    assert.equal(isEmailAddress('jan@coral'), false);
    assert.equal(isEmailAddress('jan coral@x.be'), false);
    assert.equal(isEmailAddress('jan@@x.be'), false);
});
