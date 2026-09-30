import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crewFileRefusal } from '../src/lib/crew-file-policy.ts';

test('crew call paths keep working', () => {
    assert.equal(crewFileRefusal('upload', 'hr', 'entry-1'), null);          // clock-out photos (useClockEntries)
    assert.equal(crewFileRefusal('upload', 'shifts'), null);                 // late entry (LateEntryCard)
    assert.equal(crewFileRefusal('upload', 'hr-shift', 's1'), null);         // shift attachments
    assert.equal(crewFileRefusal('list', 'global', 'workhub-shared'), null); // WorkHub → Documents
    assert.equal(crewFileRefusal('upload', 'task-notes', 'task-1'), null);   // task note photos (TASK-CREW-1)
});

test('crew cannot reach the office files', () => {
    assert.ok(crewFileRefusal('listAll'));
    assert.ok(crewFileRefusal('list', 'expenses'));
    assert.ok(crewFileRefusal('list', 'invoices', 'inv-1'));
    assert.ok(crewFileRefusal('list', 'global'));
    assert.ok(crewFileRefusal('delete'));
    assert.ok(crewFileRefusal('upload', 'expenses', 'exp-1'));
    assert.ok(crewFileRefusal('upload', 'documents'));
    assert.ok(crewFileRefusal('upload', undefined));
});
