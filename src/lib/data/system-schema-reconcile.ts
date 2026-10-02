/**
 * KERN-SCHEMA-1 · give every tenant's system databases their canonical fields — on the SERVER, at
 * provisioning (every layout load), not when someone happens to open a screen.
 * Server-only. Idempotent; never throws (a reconcile failure is logged, the page still loads).
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { SYSTEM_DATABASES, BASE_TO_KEY, type SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { canonicalSchemas, type KernelProperty } from '@/lib/kernel/system-schemas';
import { planSchemaReconcile } from '@/lib/kernel/system-schema-plan';

/** Tenants already reconciled by this server instance — the healthy path costs nothing after the first load. */
const done = new Set<string>();

export async function reconcileSystemSchemas(
    tenantId: string,
    db: Pick<PrismaClient, 'globalDatabase'>,
    lockedDbIds: Record<string, string>,
): Promise<{ changed: Array<{ role: string; added: string[]; upgraded: string[] }> }> {
    if (done.has(tenantId)) return { changed: [] };
    const changed: Array<{ role: string; added: string[]; upgraded: string[] }> = [];
    try {
        const resolve = (base: string) => {
            const role = BASE_TO_KEY[base] as SystemDatabaseRole | undefined;
            return (role && lockedDbIds[role]) || base;
        };
        const schemas = canonicalSchemas(resolve);
        const ids = Object.values(lockedDbIds).filter(Boolean);
        const rows = await db.globalDatabase.findMany({
            where: { tenantId, id: { in: ids } },
            select: { id: true, logicalKey: true, properties: true },
        });
        for (const row of rows) {
            const spec = row.logicalKey ? SYSTEM_DATABASES[row.logicalKey as SystemDatabaseRole] : undefined;
            const canonical = spec ? schemas[spec.legacyBase] : undefined;
            if (!canonical) continue;
            const current = (Array.isArray(row.properties) ? row.properties : []) as unknown as KernelProperty[];
            const plan = planSchemaReconcile(current, canonical);
            if (!plan.next) continue;
            await db.globalDatabase.update({
                where: { id: row.id },
                data: { properties: plan.next as unknown as Prisma.InputJsonValue },
            });
            changed.push({ role: String(row.logicalKey), added: plan.added, upgraded: plan.upgraded });
        }
        if (changed.length) console.info(`[KERN-SCHEMA-1] tenant ${tenantId}:`, JSON.stringify(changed));
        done.add(tenantId);
    } catch (err) {
        console.error(`[KERN-SCHEMA-1] reconcile failed for tenant ${tenantId}:`, err);
    }
    return { changed };
}
