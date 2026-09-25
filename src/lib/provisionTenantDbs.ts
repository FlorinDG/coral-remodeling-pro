/**
 * provisionTenantDbs.ts — SERVER ONLY
 *
 * Provisions all 16 system GlobalDatabase rows for a tenant and stores
 * their IDs in Tenant.lockedDbIds. Safe to call multiple times (idempotent).
 *
 * DO NOT import this file from client components — it imports PrismaClient.
 * For client-safe utilities, use @/lib/lockedDbUtils instead.
 */

import { PrismaClient } from '@prisma/client';
import {
    SYSTEM_DATABASE_ROLES,
    SYSTEM_DATABASE_NAMES,
} from '@/lib/kernel/system-databases';
import type { LockedDbKey, LockedDbIds } from '@/lib/lockedDbUtils';
import { getLockedDbId } from '@/lib/lockedDbUtils';

export type { LockedDbKey, LockedDbIds };
export { getLockedDbId };

/**
 * Provisions the 16 locked GlobalDatabase rows for a tenant.
 * Uses a Prisma transaction client if provided (for signup atomicity).
 * Safe to call multiple times — preserves existing bindings byte-for-byte.
 *
 * Returns the full LockedDbIds map.
 */
export async function provisionLockedDatabases(
    tenantId: string,
    // Accept either the main prisma client or a transaction client
    db: Pick<PrismaClient, 'globalDatabase' | 'tenant'>
): Promise<LockedDbIds> {
    const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { lockedDbIds: true },
    });
    const existing = (tenant?.lockedDbIds as Record<string, string> | null) || {};
    const ids: Record<string, string> = { ...existing };

    for (const role of SYSTEM_DATABASE_ROLES) {
        if (existing[role]) {
            ids[role] = existing[role];
            continue;
        }

        const created = await db.globalDatabase.create({
            data: {
                tenantId,
                name: SYSTEM_DATABASE_NAMES[role],
                properties: [],
                views: [],
                activeFilters: [],
                activeSorts: [],
                isTemplate: false,
                ownerId: 'system',
            },
            select: { id: true },
        });

        ids[role] = created.id;
    }

    const lockedDbIds = ids as LockedDbIds;

    // Persist the map on the tenant row
    await db.tenant.update({
        where: { id: tenantId },
        data: { lockedDbIds },
    });

    return lockedDbIds;
}
