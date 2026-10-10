/**
 * Every exported server action checks who is calling (Planner, unattended 2026-10-10). A server action is a public
 * endpoint: CRM-SCOPE-1 and CMS-SCOPE-1 found ten that wrote by id with no session check at all.
 * A guard is a call that reads the session or a scope: auth(), a scope constructor, or a local helper that wraps one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/app/actions/', import.meta.url).pathname;
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(n) ? [p] : []; });
const GUARD = /\bauth\(\)|scopeFromSession\(|systemScope\(|portalScope\(|verifySuperadmin\(|\bctx\(\)|officeSession\(|crmScope\(|cmsTenant\(/;

test('every exported server action calls a session guard', () => {
    const unguarded: string[] = [];
    for (const f of walk(DIR)) {
        const s = readFileSync(f, 'utf8');
        if (!/^["']use server["']/m.test(s)) continue;
        const starts = [...s.matchAll(/export async function (\w+)/g)];
        starts.forEach((m, i) => {
            const chunk = s.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : s.length);
            if (!GUARD.test(chunk)) unguarded.push(`${f.slice(DIR.length)}::${m[1]}`);
        });
    }
    assert.deepEqual(unguarded, []);
});
