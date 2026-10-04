/**
 * KERN-SCHEMA-1 · the numbered list of corrections to EXISTING system fields — pure, tested
 * (tests/system-schema-plan.test.ts).
 *
 * The reconcile only ever ADDS missing fields; it never renames, retypes or reconfigures one a tenant
 * already has. When the kernel itself must change an existing field (BESTEK-COMP-1's price formula,
 * COL-PERM-1's permission information on system fields), that change is a step in this list.
 *
 * Each step carries its own guard: it applies only while the field still has the OLD shape the step
 * replaces. So nothing needs storing per tenant — a step that ran no longer matches — and a field the
 * tenant changed themselves is left alone (and reported, not overwritten). Steps run in list order;
 * append only, never reorder or edit a published step.
 *
 * Custom (tenant) fields are never in this list: they are the tenant's data.
 */
import type { KernelProperty } from './system-schemas';

export interface SchemaUpgrade {
    /** Stable, numbered: 'U1-…', 'U2-…' — the order is the number. */
    id: string;
    /** The system databases it concerns, by legacy base id ('db-bestek'), or '*' for every one. */
    bases: string[] | '*';
    propertyId: string;
    /** True while the field still has the shape this step replaces. Must be false once applied. */
    appliesTo: (p: KernelProperty) => boolean;
    apply: (p: KernelProperty) => KernelProperty;
    /** A field in the old shape — the tests prove the guard and the idempotence on it. */
    before: KernelProperty;
}

export const SCHEMA_UPGRADES: SchemaUpgrade[] = [
    {
        // The screen's legacy fix, moved here: the accountant-export marker was once created as a date.
        id: 'U1-accountant-export-checkbox',
        bases: '*',
        propertyId: 'accountantExportedAt',
        appliesTo: p => p.type !== 'checkbox',
        apply: p => ({ ...p, type: 'checkbox' }),
        before: { id: 'accountantExportedAt', name: 'Verzonden naar boekhouder', type: 'date' },
    },
];

export function upgradesFor(base: string, list: SchemaUpgrade[] = SCHEMA_UPGRADES): SchemaUpgrade[] {
    return list.filter(u => u.bases === '*' || u.bases.includes(base));
}
