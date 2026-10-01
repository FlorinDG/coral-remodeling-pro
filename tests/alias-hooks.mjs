/**
 * Minimal ESM resolve hook so tests can import app modules that use the `@/` alias.
 * Zero dependencies — uses Node's built-in module hooks (Node 22+).
 *
 * Registered via tests/register.mjs, which is loaded with `node --import`.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '..', 'src');

export async function resolve(specifier, context, nextResolve) {
    // R2-5 stubs — ONLY for modules imported from the client database store and its folder
    // (src/components/admin/database/**). Any other test keeps the real modules: a stub must never
    // silently stand in for code another test means to exercise.
    const fromStore = !!context.parentURL && context.parentURL.includes('/src/components/admin/database/');
    const stub = (file) => nextResolve(pathToFileURL(path.resolve(import.meta.dirname, 'stubs', file)).href, context);
    if (fromStore) {
        if (specifier === 'zustand/middleware') return stub('zustand-middleware.ts');
        if (specifier === 'idb-keyval') return stub('idb-keyval.ts');
        if (specifier === 'sonner') return stub('sonner.ts');
        if (specifier === '@/app/actions/global-databases') return stub('global-databases.ts');
        if (specifier === '@/app/actions/pages') return stub('pages.ts');
        if (specifier === '@/components/admin/database/types' || specifier === './types') return stub('types.ts');
    }
    if (specifier.startsWith('next/') && !specifier.endsWith('.js')) {
        return nextResolve(`${specifier}.js`, context);
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const parentPath = context.parentURL && context.parentURL.startsWith('file:') ? fileURLToPath(context.parentURL) : '';
        if (parentPath) {
            const base = path.resolve(path.dirname(parentPath), specifier);
            const candidates = [
                base,
                `${base}.ts`,
                `${base}.tsx`,
                `${base}.js`,
                `${base}.mjs`,
                path.join(base, 'index.ts'),
                path.join(base, 'index.tsx'),
                path.join(base, 'index.js'),
            ];
            const { existsSync, statSync } = await import('node:fs');
            for (const c of candidates) {
                if (existsSync(c) && statSync(c).isFile()) {
                    return nextResolve(pathToFileURL(c).href, context);
                }
            }
        }
    }
    if (specifier.startsWith('@/')) {
        const rel = specifier.slice(2);
        const base = path.join(SRC, rel);

        // Try the exact path, then common TS/TSX extensions, then index files.
        const candidates = [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            path.join(base, 'index.ts'),
            path.join(base, 'index.tsx'),
        ];

        const { existsSync, statSync } = await import('node:fs');
        for (const c of candidates) {
            if (existsSync(c) && statSync(c).isFile()) {
                return nextResolve(pathToFileURL(c).href, context);
            }
        }
        throw new Error(`[alias-hooks] Could not resolve "${specifier}" under ${SRC}`);
    }
    return nextResolve(specifier, context);
}
