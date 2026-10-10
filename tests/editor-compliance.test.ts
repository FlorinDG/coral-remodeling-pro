/**
 * EDITOR-1 · E4–E7 — TipTap complies with the ERP's rules (Florin 2026-10-09). Plan: .agents/plans/EDITOR-1.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });
const FILES = walk(SRC);
const rel = (p: string) => p.slice(SRC.length + 1);
const read = (p: string) => readFileSync(p, 'utf8');
const EDITOR = join(SRC, 'components/editor/RichText.tsx');

test('E6 · ONE rich-text primitive: no contentEditable / execCommand outside it (allowed: the @date mention helper)', () => {
    const ALLOWED = new Set(['components/admin/database/components/GlobalMentionDateInterceptor.tsx']);
    const offenders = FILES.filter(p => !ALLOWED.has(rel(p)) && !rel(p).startsWith('lib/records/rich-text'))
        .filter(p => /\bcontentEditable\b|document\.execCommand\(/.test(read(p))).map(rel);
    assert.deepEqual(offenders, []);
});

test('E1 · the editor makes only the allowlist: headings, code, quotes, rules, strike and links are off; it emits via sanitizeRichText', () => {
    const src = read(EDITOR);
    for (const off of ['heading', 'code', 'codeBlock', 'blockquote', 'horizontalRule', 'strike', 'link']) {
        assert.match(src, new RegExp(`\\b${off}: false\\b`), `${off} must be disabled`);
    }
    assert.match(src, /sanitizeRichText\(editor\.getHTML\(\)\)/);
});

test('E5 · the editor never persists: no store, door, action or fetch inside it', () => {
    const src = read(EDITOR);
    assert.doesNotMatch(src, /useDatabaseStore|@\/lib\/data|@\/app\/actions|fetch\(|saveRecord/);
});

test('E4 · no data leaves the tenant: no cloud / collaboration / AI extension anywhere; TipTap pinned exactly', () => {
    const forbidden = /@tiptap-pro|@tiptap\/extension-collaboration|@tiptap-cloud|@hocuspocus|y-prosemirror|@tiptap\/extension-ai/;
    assert.deepEqual(FILES.filter(p => forbidden.test(read(p))).map(rel), []);
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const tiptap = Object.entries(deps).filter(([n]) => n.startsWith('@tiptap/'));
    assert.ok(tiptap.length >= 4);
    for (const [n, v] of tiptap) assert.match(v, /^\d+\.\d+\.\d+$/, `${n} must be pinned exactly (got ${v})`);
    assert.ok(!Object.keys(deps).some(n => forbidden.test(n)));
});

test('E6 · toolbar labels come from i18n, in all four languages', () => {
    for (const l of ['en', 'nl', 'fr', 'ro']) {
        const m = JSON.parse(readFileSync(join(SRC, 'messages', `${l}.json`), 'utf8'));
        for (const k of ['toolbar', 'bold', 'italic', 'underline', 'bulletList', 'orderedList']) assert.ok(m.Admin?.editor?.[k], `${l}: Admin.editor.${k}`);
    }
});
