/**
 * KERN-SCHEMA-1 · what a tenant's system database is missing — pure, tested (tests/system-schema-plan.test.ts).
 *
 * Rules (the same the screen used, now on the server for every tenant):
 *   - canonical properties missing BY ID are appended, in canonical order;
 *   - an existing property is NEVER renamed, retyped, reconfigured or removed — a tenant (or the
 *     superadmin) may have customised it; corrections to existing fields are the numbered steps in
 *     system-schema-upgrades.ts, each applied only while the field still has the old shape;
 *   - custom (non-canonical) properties are kept as they are.
 */
import type { KernelProperty as Property } from './system-schemas';
import type { SchemaUpgrade } from './system-schema-upgrades';

export interface SchemaPlan {
    added: string[];          // ids appended
    upgraded: string[];       // upgrade step ids applied ('U1-…')
    next: Property[] | null;  // the full new property list, or null when nothing changes
}

export function planSchemaReconcile(current: Property[], canonical: Property[], upgrades: SchemaUpgrade[]): SchemaPlan {
    const have = new Set(current.map(p => p.id));
    const missing = canonical.filter(p => !have.has(p.id));
    const upgraded: string[] = [];
    let patched = current;
    for (const step of upgrades) {                       // in list order: a later step may build on an earlier one
        patched = patched.map(p => {
            if (p.id !== step.propertyId || !step.appliesTo(p)) return p;
            const next = step.apply(p);
            if (step.appliesTo(next)) throw new Error(`[KERN-SCHEMA-1] upgrade ${step.id} is not idempotent`);
            upgraded.push(step.id);
            return next;
        });
    }
    if (!missing.length && !upgraded.length) return { added: [], upgraded: [], next: null };
    return { added: missing.map(p => p.id), upgraded, next: [...patched, ...missing] };
}
