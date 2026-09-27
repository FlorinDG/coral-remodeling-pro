import prisma from "@/lib/prisma";
import type { SystemDatabaseRole } from "@/lib/kernel/system-databases";

/**
 * Forward binding: role → databaseId (reads Tenant.lockedDbIds)
 */
export async function systemDatabaseId(tenantId: string, role: SystemDatabaseRole): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true }
    });
    if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
    }
    const locked = (tenant.lockedDbIds as Record<string, string> | null) || {};
    const id = locked[role];
    if (!id) {
        throw new Error(`No database found for role "${role}" in tenant ${tenantId}`);
    }
    return id;
}

/**
 * Reverse binding: databaseId → role (reads GlobalDatabase.logicalKey)
 *
 * Strict single SELECT. Zero parsing, zero string manipulation.
 * Throws for nonexistent database. Returns null for custom database.
 */
export async function roleOfDatabase(
    tenantId: string,
    databaseId: string,
    client: any = prisma
): Promise<SystemDatabaseRole | null> {
    const db = await client.globalDatabase.findFirst({
        where: { id: databaseId, tenantId },
        select: { logicalKey: true },
    });
    if (!db) {
        throw new Error(`Database not found: "${databaseId}" for tenant "${tenantId}"`);
    }
    return (db.logicalKey as SystemDatabaseRole) || null;
}
