import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInSeries, proformaSeries } from '../src/lib/records/series.ts';

test('the next proforma number: after the highest of THIS year, never reused (throw proof: "Proforma" as a title)', () => {
    const s = proformaSeries('2026');
    assert.equal(nextInSeries([], s), 'PF-2026-001');
    assert.equal(nextInSeries(['PF-2026-001', 'PF-2026-007', 'PF-2026-003'], s), 'PF-2026-008');
    assert.equal(nextInSeries(['PF-2025-044', 'Proforma', 'PF-2026-00x', 'F-2026-012'], s), 'PF-2026-001');   // other years / other text ignored
    assert.equal(nextInSeries(['PF-2026-999'], s), 'PF-2026-1000');                                           // never wraps
});
