/**
 * provisionTenantDbs.ts — SERVER ONLY
 *
 * Provisions all 16 system GlobalDatabase rows for a tenant and stores
 * their IDs in Tenant.lockedDbIds. Safe to call multiple times (idempotent).
 *
 * Call this unconditionally. It is idempotent by binding, writes nothing when
 * the tenant is complete, and is the ONLY repair path for a partially-bound tenant.
 * Do not guard it — a guard on `lockedDbIds` being non-empty is what kept
 * `Murgu, Catalin` at 6 of 16 roles indefinitely.
 *
 * DO NOT import this file from client components — it imports PrismaClient.
 * For client-safe utilities, use @/lib/lockedDbUtils instead.
 */

import type { PrismaClient } from '@prisma/client';
import {
    SYSTEM_DATABASE_ROLES,
    SYSTEM_DATABASE_NAMES,
} from '@/lib/kernel/system-databases';
import type { LockedDbKey, LockedDbIds } from '@/lib/lockedDbUtils';
import { getLockedDbId } from '@/lib/lockedDbUtils';
import { reconcileSystemSchemas } from '@/lib/data/system-schema-reconcile';

export type { LockedDbKey, LockedDbIds };
export { getLockedDbId };

/**
 * Provisions the 16 locked GlobalDatabase rows for a tenant.
 * Uses a Prisma transaction client if provided (for signup atomicity).
 * Safe to call multiple times — preserves existing bindings byte-for-byte.
 *
 * Call this unconditionally. It is idempotent by binding, writes nothing when the
 * tenant is complete, and is the ONLY repair path for a partially-bound tenant.
 * Do not guard it — a guard on `lockedDbIds` being non-empty is what kept
 * `Murgu, Catalin` at 6 of 16 roles indefinitely.
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

    // Resolve existing bindings in ONE query to keep the healthy path cheap
    const existingIds = Array.from(new Set(Object.values(existing).filter(Boolean)));
    const existingRows = existingIds.length > 0
        ? await db.globalDatabase.findMany({
            where: {
                id: { in: existingIds },
                tenantId,
            },
            select: { id: true, logicalKey: true },
        })
        : [];
    const rowById = new Map(existingRows.map(r => [r.id, r]));

    let created = 0;
    let bindingsChanged = false;

    for (const role of SYSTEM_DATABASE_ROLES) {
        const boundId = existing[role];
        const existingRow = boundId ? rowById.get(boundId) : undefined;

        if (existingRow) {
            ids[role] = boundId;
            // Backfill logicalKey on a resolving row that lacks it
            if (!existingRow.logicalKey) {
                await db.globalDatabase.update({
                    where: { id: existingRow.id },
                    data: { logicalKey: role },
                });
                existingRow.logicalKey = role;
            }
            continue;
        }

        const createdRow = await db.globalDatabase.create({
            data: {
                tenantId,
                logicalKey: role,
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

        ids[role] = createdRow.id;
        created++;

        if (boundId) {
            bindingsChanged = true;
            console.warn(
                `[provisionLockedDatabases] Repaired dangling binding for role "${role}" on tenant "${tenantId}": old id "${boundId}" did not resolve to a database row; provisioned replacement "${createdRow.id}"`
            );
        }
    }

    const lockedDbIds = ids as LockedDbIds;

    // Persist the map on the tenant row ONLY if new databases were created or bindings were repaired
    if (created > 0 || bindingsChanged) {
        await db.tenant.update({
            where: { id: tenantId },
            data: { lockedDbIds },
        });
    }

    // KERN-SCHEMA-1: every system database gets its canonical fields here, on the server, for every
    // tenant — not when someone happens to open the screen (Murgu had 0 fields on 10 databases).
    await reconcileSystemSchemas(tenantId, db, lockedDbIds);

    return lockedDbIds;
}
