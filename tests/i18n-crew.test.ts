/**
 * I18N-TT-1 — the crew app's own i18n instance (react-i18next, src/components/time-tracker/i18n).
 * tests/i18n.test.ts guards next-intl only; this is the crew half. Found 2026-09-30: six keys used but
 * defined nowhere (WHS-1), and Russian 12 keys behind — both invisible until a crew phone showed them.
 *
 * 1. Every locale carries every key of `en` (plural variants _one/_few/_many/_other/_zero/_two count
 *    as one key — ro/ru legitimately have more forms).
 * 2. Every literal t('a.b') in files that use react-i18next resolves in `en`.
 * 3. No empty strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'components', 'time-tracker', 'i18n', 'locales');
const CREW_LOCALES = ['en', 'nl', 'fr', 'ro', 'ru'];
const PLURAL = /_(zero|one|two|few|many|other)$/;

function leaves(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) for (const [kk, vv] of leaves(v as Record<string, unknown>, name)) out.set(kk, vv);
        else out.set(name, v);
    }
    return out;
}
const base = (k: string) => k.replace(PLURAL, '');
const load = (l: string) => leaves(JSON.parse(readFileSync(path.join(LOCALES_DIR, `${l}.json`), 'utf8')));

function walk(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e.startsWith('.')) continue;
        const full = path.join(dir, e);
        if (statSync(full).isDirectory()) walk(full, acc);
        else if (/\.(tsx|ts)$/.test(e)) acc.push(full);
    }
    return acc;
}

const en = load('en');
const enBases = new Set([...en.keys()].map(base));

test('every crew locale carries every key of en (plural forms count as one)', () => {
    for (const l of CREW_LOCALES.filter(x => x !== 'en')) {
        const bases = new Set([...load(l).keys()].map(base));
        const missing = [...enBases].filter(k => !bases.has(k));
        assert.deepEqual(missing, [], `${l} is missing: ${missing.join(', ')}`);
    }
});

test('no empty strings in any crew locale', () => {
    for (const l of CREW_LOCALES) {
        const empty = [...load(l)].filter(([, v]) => typeof v === 'string' && !v.trim()).map(([k]) => k);
        assert.deepEqual(empty, [], `${l} has empty values: ${empty.join(', ')}`);
    }
});

test("every literal t('…') in a react-i18next file resolves in en", () => {
    const missing: string[] = [];
    for (const file of walk(path.join(ROOT, 'src'))) {
        const src = readFileSync(file, 'utf8');
        if (!/from ['"]react-i18next['"]/.test(src)) continue;
        for (const m of src.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.\-]+)['"]/g)) {
            const key = m[1];
            if (!key.includes('.')) continue;                // not a namespaced key
            if (!enBases.has(key) && !en.has(key)) missing.push(`${path.relative(ROOT, file)}: ${key}`);
        }
    }
    assert.deepEqual(missing, [], `keys used but not defined in en:\n${missing.join('\n')}`);
});
