import { test } from 'node:test';
import assert from 'node:assert/strict';
import { werkbonStatus, isWerkbonArtifact } from '../src/lib/records/werkbon-status.ts';
import { isWerkbonFile, werkbonFileName } from '../src/lib/records/werkbon-number.ts';

const sign = { after: { signerName: 'Familie Janssens', signedAt: '2026-10-05T07:10:00.000Z', number: 'WB-2026-0001', signatureKey: 'k' } };

test('unsigned → no status; signed without PDF → pdf_pending', () => {
    assert.equal(werkbonStatus({}), null);
    assert.equal(werkbonStatus({ sign: { after: { signedAt: 'x' } } }), null);
    const s = werkbonStatus({ sign })!;
    assert.equal(s.state, 'pdf_pending');
    assert.equal(s.number, 'WB-2026-0001');
    assert.equal(s.signerName, 'Familie Janssens');
    assert.equal(s.pdf, null);
});

test('PDF stored, nothing sent → not_sent; every send listed oldest first with its recipients', () => {
    const pdf = { after: { key: 't_x/hr-shift/a/Werkbon WB-2026-0001 2026-10-05.pdf', fileName: 'Werkbon WB-2026-0001 2026-10-05.pdf' } };
    assert.equal(werkbonStatus({ sign, pdf })!.state, 'not_sent');
    const s = werkbonStatus({ sign, pdf, sent: [
        { after: { to: ['b@x.be'], cc: ['office@coral.be'], sentAt: '2026-10-06T09:00:00.000Z' } },
        { after: { to: ['a@x.be'], cc: [], sentAt: '2026-10-05T09:00:00.000Z' } },
        { after: { to: [], cc: ['ignored@x.be'] } },             // a send without a recipient is no send
    ] })!;
    assert.equal(s.state, 'sent');
    assert.deepEqual(s.sends.map(x => x.to[0]), ['a@x.be', 'b@x.be']);
    assert.deepEqual(s.sends[1].cc, ['office@coral.be']);
});

test('the signed PDF and the legacy signature image are not ordinary attachments (throw proof: a photo is)', () => {
    assert.equal(isWerkbonArtifact({ name: werkbonFileName('WB-2026-0001', '2026-10-05', 'nl') }, isWerkbonFile), true);
    assert.equal(isWerkbonArtifact({ name: 'Handtekening — Familie Janssens.png' }, isWerkbonFile), true);
    assert.equal(isWerkbonArtifact({ name: 'IMG_0042.jpg' }, isWerkbonFile), false);
    assert.equal(isWerkbonArtifact({ name: 'Handtekening plan.pdf' }, isWerkbonFile), false);
});
