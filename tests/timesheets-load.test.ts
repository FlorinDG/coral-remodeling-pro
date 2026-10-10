/**
 * TS-FLASH-1 (Florin 2026-10-10): the timesheets screen showed "no entries" for a second or two on a first visit.
 * The URL had no period yet: fetchData redirected to add it and returned, and its `finally` cleared the spinner, so
 * the empty table stood for the whole navigation. Now the report is read at once, and the run that follows the new
 * URL shares the same request.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGE = readFileSync('src/app/[locale]/admin/hr/timesheets/page.tsx', 'utf8');
const fetchData = PAGE.slice(PAGE.indexOf('const fetchData = async'), PAGE.indexOf('const refresh = ()'));

test('TS-FLASH-1: naming the period in the URL never ends the load (no return after router.replace)', () => {
    assert.ok(fetchData.length > 0);
    assert.doesNotMatch(fetchData, /router\.replace\([^;]*\);\s*return\b/);
    assert.match(fetchData, /if \(key !== searchParams\.toString\(\)\) router\.replace\(/);
});

test('TS-FLASH-1: the report is read through the shared in-flight request', () => {
    assert.match(fetchData, /await loadReport\(key\)/);
    assert.doesNotMatch(fetchData, /hrFetch<Report>/);
    assert.match(PAGE, /const reportInFlight = new Map<string, Promise<Report>>\(\);/);
});
