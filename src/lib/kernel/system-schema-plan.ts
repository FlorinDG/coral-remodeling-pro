/**
 * KERN-SCHEMA-1 · what a tenant's system database is missing — pure, tested (tests/system-schema-plan.test.ts).
 *
 * Rules (the same the screen used, now on the server for every tenant):
 *   - canonical properties missing BY ID are appended, in canonical order;
 *   - an existing property is NEVER renamed, retyped, reconfigured or removed — a tenant (or the
 *     superadmin) may have customised it; corrections to existing fields are explicit, versioned
 *     upgrades (one so far: `accountantExportedAt` must be a checkbox — the screen's legacy fix);
 *   - custom (non-canonical) properties are kept as they are.
 */
import type { KernelProperty as Property } from './system-schemas';

export interface SchemaPlan {
    added: string[];          // ids appended
    upgraded: string[];       // ids corrected by a versioned upgrade
    next: Property[] | null;  // the full new property list, or null when nothing changes
}

export function planSchemaReconcile(current: Property[], canonical: Property[]): SchemaPlan {
    const have = new Set(current.map(p => p.id));
    const missing = canonical.filter(p => !have.has(p.id));
    const upgraded: string[] = [];
    const patched = current.map(p => {
        if (p.id === 'accountantExportedAt' && p.type !== 'checkbox') {   // legacy fix, from the screen
            upgraded.push(p.id);
            return { ...p, type: 'checkbox' };
        }
        return p;
    });
    if (!missing.length && !upgraded.length) return { added: [], upgraded: [], next: null };
    return { added: missing.map(p => p.id), upgraded, next: [...patched, ...missing] };
}
