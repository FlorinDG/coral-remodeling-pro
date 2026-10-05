/**
 * R1-5 · CLOSE THE DOOR — the seraph gate's allowlist is a RATCHET: it may only shrink.
 * eslint (eslint.config.mjs, "PRE-1d.2 / R1-5") fails any file outside src/lib/data that imports @/lib/prisma,
 * except the grandfathered ones. This test keeps that list honest:
 *   - every entry still exists and still imports the raw client (a migrated file MUST leave the list — that is
 *     the progress metric; 8 stale entries were found 2026-10-05);
 *   - the list never grows past its ceiling (lower CEILING when you remove entries; never raise it);
 *   - every raw importer outside lib/data is on the list (so eslint and this test agree).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CEILING = 96;
const ROOT = process.cwd();
const RAW = /from ['"]@\/lib\/prisma['"]|from ['"](\.\.\/)+lib\/prisma['"]/;

function allowlist(): string[] {
    const cfg = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    const start = cfg.indexOf('// PRE-1d.2 / R1-5: The Seraph gate');
    assert.ok(start >= 0, 'the R1-5 block is in eslint.config.mjs');
    const block = cfg.slice(start, cfg.indexOf('rules:', start));
    return [...block.matchAll(/^\s+"(src\/[^"]+)",/gm)].map(m => m[1]).filter(e => e !== 'src/lib/data/**' && e !== 'src/lib/prisma.ts');
}

/** eslint's minimatch `*` inside one segment — enough for the `*locale*`-style entries this list uses. */
function matches(pattern: string, file: string): boolean {
    const re = new RegExp('^' + pattern.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    return re.test(file);
}

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(relative(ROOT, p));
    }
    return out;
}

const files = walk(join(ROOT, 'src'));
const rawImporters = files.filter(f => !f.startsWith('src/lib/data/') && f !== 'src/lib/prisma.ts' && RAW.test(readFileSync(f, 'utf8')));

test('R1-5: every grandfathered entry still exists and still imports the raw client — a migrated file leaves the list', () => {
    const stale = allowlist().filter(e => !rawImporters.some(f => matches(e, f)));
    assert.deepEqual(stale, [], `remove these from the R1-5 allowlist (and lower CEILING): ${stale.join(', ')}`);
});

test('R1-5: the allowlist never grows', () => {
    const n = allowlist().length;
    assert.ok(n <= CEILING, `allowlist has ${n} entries, ceiling ${CEILING} — the seraph gate is a ratchet: do not add`);
});

test('R1-5: no raw importer outside lib/data escapes the list (eslint and this test agree)', () => {
    const list = allowlist();
    const escaped = rawImporters.filter(f => !list.some(e => matches(e, f)));
    assert.deepEqual(escaped, [], `outside lib/data, importing @/lib/prisma, not grandfathered: ${escaped.join(', ')}`);
});
