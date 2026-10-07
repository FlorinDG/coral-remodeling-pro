import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFromModal } from '../src/lib/dom/page-shortcut.ts';

test('a key typed inside a modal dialog is not a page shortcut (throw proof: Cmd+Z in the send dialog undid the quote)', () => {
    const inside = { closest: (s: string) => (s === '[aria-modal="true"]' ? {} : null) };
    const outside = { closest: () => null };
    assert.equal(isFromModal(inside as never), true);
    assert.equal(isFromModal(outside as never), false);
    assert.equal(isFromModal(null), false);
    assert.equal(isFromModal({} as never), false);   // window / document as target
});
