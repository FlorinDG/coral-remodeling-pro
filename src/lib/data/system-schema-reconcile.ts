/**
 * KERN-SCHEMA-1 · give every tenant's system databases their canonical fields — on the SERVER, at
 * provisioning (every layout load), not when someone happens to open a screen.
 * Server-only. Idempotent; never throws (a reconcile failure is logged, the page still loads).
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { SYSTEM_DATABASES, BASE_TO_KEY, type SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { canonicalSchemas, UNIVERSAL_FIELDS, type KernelProperty } from '@/lib/kernel/system-schemas';
import { planSchemaReconcile } from '@/lib/kernel/system-schema-plan';
import { upgradesFor } from '@/lib/kernel/system-schema-upgrades';
import { systemDatabaseEntitled } from '@/lib/kernel/system-schema-entitlement';

/** Tenants already reconciled by this server instance — the healthy path costs nothing after the first load. */
const done = new Set<string>();   // key: tenant + plan + modules — a plan change reconciles again

export async function reconcileSystemSchemas(
    tenantId: string,
    db: Pick<PrismaClient, 'globalDatabase'>,
    lockedDbIds: Record<string, string>,
    entitlement: { planType: string | null | undefined; activeModules: string[] },
): Promise<{ changed: Array<{ role: string; added: string[]; upgraded: string[] }> }> {
    const key = `${tenantId}|${entitlement.planType}|${[...entitlement.activeModules].sort().join(',')}`;
    if (done.has(key)) return { changed: [] };
    const changed: Array<{ role: string; added: string[]; upgraded: string[] }> = [];
    try {
        const resolve = (base: string) => {
            const role = BASE_TO_KEY[base] as SystemDatabaseRole | undefined;
            return (role && lockedDbIds[role]) || base;
        };
        const schemas = canonicalSchemas(resolve);
        const bound = new Set(Object.values(lockedDbIds).filter(Boolean));
        // EVERY database of the tenant: its bound system databases get their canonical fields; every database —
        // custom ones and non-entitled system ones too — gets the universal fields (COMMENTS-1).
        const rows = await db.globalDatabase.findMany({
            where: { tenantId },
            select: { id: true, logicalKey: true, properties: true },
        });
        for (const row of rows) {
            const spec = row.logicalKey && bound.has(row.id) ? SYSTEM_DATABASES[row.logicalKey as SystemDatabaseRole] : undefined;
            // Tier gate (Florin 2026-10-03): only the databases this tenant's plan / modules entitle it to.
            const entitled = !!spec && systemDatabaseEntitled(spec.role, entitlement.planType, entitlement.activeModules);
            const canonical = (entitled && spec ? schemas[spec.legacyBase] : undefined) || UNIVERSAL_FIELDS;
            const current = (Array.isArray(row.properties) ? row.properties : []) as unknown as KernelProperty[];
            const plan = planSchemaReconcile(current, canonical, entitled && spec ? upgradesFor(spec.legacyBase) : []);
            if (!plan.next) continue;
            await db.globalDatabase.update({
                where: { id: row.id },
                data: { properties: plan.next as unknown as Prisma.InputJsonValue },
            });
            changed.push({ role: String(row.logicalKey ?? row.id), added: plan.added, upgraded: plan.upgraded });
        }
        if (changed.length) console.info(`[KERN-SCHEMA-1] tenant ${tenantId}:`, JSON.stringify(changed));
        done.add(key);
    } catch (err) {
        console.error(`[KERN-SCHEMA-1] reconcile failed for tenant ${tenantId}:`, err);
    }
    return { changed };
}
