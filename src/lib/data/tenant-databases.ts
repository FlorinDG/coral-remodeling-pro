/**
 * The door that prepares the signed-in tenant's system databases — the ONE place every app shell (admin, the mobile
 * office, WorkHub) does it (MOBILE-PERF-1; was an inline copy in each layout):
 *  - bindSystemDatabases: bind / repair the kernel's system databases (lib/provisionTenantDbs);
 *  - prepareTenantDatabases: that, then the schema reconcile (KERN-SCHEMA-1 — canonical fields), which must run
 *    BEFORE the schemas are read. Memoized per server instance.
 * The tenant comes from the SESSION, never from the caller (D3); tenant-level kernel work → the platform door (D4).
 */
import { auth } from '@/auth';
import { platformDb } from '@/lib/data/scope';
import { provisionLockedDatabases } from '@/lib/provisionTenantDbs';
import { reconcileSystemSchemas } from '@/lib/data/system-schema-reconcile';

export interface PreparedDatabases {
    lockedDbIds: Record<string, string>;
    /** Milliseconds per step — for the caller's timing log. */
    ms: { provision: number; reconcile?: number };
}

async function sessionTenant(): Promise<string | null> {
    const session = await auth();
    return session?.user?.tenantId ?? null;
}

export async function bindSystemDatabases(): Promise<PreparedDatabases | null> {
    const tenantId = await sessionTenant();
    if (!tenantId) return null;
    const s = performance.now();
    const lockedDbIds = await provisionLockedDatabases(tenantId, platformDb());
    return { lockedDbIds, ms: { provision: Math.round(performance.now() - s) } };
}

export async function prepareTenantDatabases(entitlement: { planType: string; activeModules: string[] }): Promise<PreparedDatabases | null> {
    const bound = await bindSystemDatabases();
    const tenantId = await sessionTenant();
    if (!bound || !tenantId) return null;
    const s = performance.now();
    await reconcileSystemSchemas(tenantId, platformDb(), bound.lockedDbIds, entitlement);
    return { lockedDbIds: bound.lockedDbIds, ms: { ...bound.ms, reconcile: Math.round(performance.now() - s) } };
}
