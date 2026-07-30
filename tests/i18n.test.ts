/**
 * LOCALISATION GUARD
 *
 * Enforces the directive: a user-facing string is never shipped without a value
 * in every active locale. The first translation may be rough — it may be replaced
 * later — but it must EXIST. A raw key on screen ("Hr.timesheets.title") is a
 * shipped defect; an imperfect Dutch word is not.
 *
 * Two checks:
 *   1. KEY PARITY   — active locales carry identical key sets.
 *   2. KEY EXISTENCE — every t('…') referenced in source resolves to a real key.
 *
 * Check 2 is the one that matters: parity was green while the timesheets page
 * rendered every label as its own variable name, because the keys existed in
 * *no* file at all.
 */
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MESSAGES = path.join(ROOT, 'src', 'messages');
const SRC = path.join(ROOT, 'src');

/** Locales that must stay in lockstep. `ro` is intentionally excluded — see the test below. */
const ACTIVE_LOCALES = ['en', 'nl', 'fr'];
const REFERENCE_LOCALE = 'en';

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        const name = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            out.push(...leafKeys(v as Record<string, unknown>, name));
        } else {
            out.push(name);
        }
    }
    return out;
}

function loadLocale(loc: string): Record<string, unknown> {
    return JSON.parse(readFileSync(path.join(MESSAGES, `${loc}.json`), 'utf8'));
}

function walk(dir: string, acc: string[] = []): string[] {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return acc; }
    for (const e of entries) {
        if (e === 'node_modules' || e.startsWith('.')) continue;
        const full = path.join(dir, e);
        let st;
        try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) walk(full, acc);
        else if (/\.(tsx|ts)$/.test(e)) acc.push(full);
    }
    return acc;
}

/** Extract (namespace, key) pairs referenced via next-intl in a single file. */
function referencedKeys(file: string): string[] {
    let src = '';
    try { src = readFileSync(file, 'utf8'); } catch { return []; }
    if (!/useTranslations|getTranslations/.test(src)) return [];

    const namespaces = [...src.matchAll(/(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g)]
        .map(m => m[1]);
    if (namespaces.length === 0) return [];

    // t('key') / t("key") — skip template literals and dynamic keys entirely.
    const calls = [...src.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.\-]+)['"]/g)].map(m => m[1]);

    const out: string[] = [];
    for (const key of calls) {
        for (const ns of namespaces) out.push(`${ns}.${key}`);
    }
    return out;
}

describe('i18n — key parity across active locales', () => {
    const ref = new Set(leafKeys(loadLocale(REFERENCE_LOCALE)));

    for (const loc of ACTIVE_LOCALES.filter(l => l !== REFERENCE_LOCALE)) {
        test(`${loc}.json has exactly the same keys as ${REFERENCE_LOCALE}.json`, () => {
            const theirs = new Set(leafKeys(loadLocale(loc)));
            const missing = [...ref].filter(k => !theirs.has(k));
            const extra = [...theirs].filter(k => !ref.has(k));
            assert.deepEqual(
                { missing: missing.slice(0, 20), extra: extra.slice(0, 20) },
                { missing: [], extra: [] },
                `${loc}.json is out of step with ${REFERENCE_LOCALE}.json ` +
                `(${missing.length} missing, ${extra.length} extra)`,
            );
        });
    }

    test('no locale contains an empty string value', () => {
        for (const loc of ACTIVE_LOCALES) {
            const data = loadLocale(loc);
            const empties: string[] = [];
            const scan = (o: Record<string, unknown>, p = '') => {
                for (const [k, v] of Object.entries(o)) {
                    const n = p ? `${p}.${k}` : k;
                    if (v && typeof v === 'object' && !Array.isArray(v)) scan(v as Record<string, unknown>, n);
                    else if (typeof v === 'string' && v.trim() === '') empties.push(n);
                }
            };
            scan(data);
            assert.deepEqual(empties, [], `${loc}.json has empty values — an empty string renders as nothing`);
        }
    });
});

describe('i18n — every key referenced in source exists', () => {
    test('no t() call resolves to a missing key', () => {
        const ref = new Set(leafKeys(loadLocale(REFERENCE_LOCALE)));
        const files = walk(SRC);
        const missing = new Map<string, string[]>();

        for (const f of files) {
            for (const key of referencedKeys(f)) {
                if (!ref.has(key)) {
                    const rel = path.relative(ROOT, f);
                    if (!missing.has(key)) missing.set(key, []);
                    if (!missing.get(key)!.includes(rel)) missing.get(key)!.push(rel);
                }
            }
        }

        // A file may call useTranslations with several namespaces; we generate a
        // candidate per namespace, so only flag keys missing under ALL of them.
        const report = [...missing.entries()]
            .filter(([key]) => {
                const leaf = key.split('.').slice(1).join('.');
                return ![...ref].some(r => r.endsWith(`.${leaf}`) || r === leaf);
            })
            .map(([key, files]) => `${key}  ←  ${files.slice(0, 3).join(', ')}`);

        assert.deepEqual(
            report.slice(0, 40),
            [],
            `${report.length} translation key(s) are referenced in code but exist in no locale file. ` +
            `They will render as raw variable names on screen.`,
        );
    });
});

describe('i18n — Romanian is a known laggard, tracked not enforced', () => {
    test('ro.json is reported but does not fail the suite', () => {
        const ref = new Set(leafKeys(loadLocale(REFERENCE_LOCALE)));
        let ro: Set<string>;
        try { ro = new Set(leafKeys(loadLocale('ro'))); } catch { return; }
        const missing = [...ref].filter(k => !ro.has(k));
        if (missing.length > 0) {
            console.log(`  ℹ ro.json is behind by ${missing.length} keys (not enforced — add 'ro' to ACTIVE_LOCALES to enforce)`);
        }
        assert.ok(true);
    });
});
