/**
 * Minimal ESM resolve hook so tests can import app modules that use the `@/` alias.
 * Zero dependencies — uses Node's built-in module hooks (Node 22+).
 *
 * Registered via tests/register.mjs, which is loaded with `node --import`.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '..', 'src');

export async function resolve(specifier, context, nextResolve) {
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
