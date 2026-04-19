/**
 * provisionTenantDbs.ts — SERVER ONLY
 *
 * Creates the 6 locked GlobalDatabase rows for a new tenant and stores
 * their IDs in Tenant.lockedDbIds. Safe to call multiple times (idempotent).
 *
 * DO NOT import this file from client components — it imports PrismaClient.
 * For client-safe utilities, use @/lib/lockedDbUtils instead.
 */

import { PrismaClient } from '@prisma/client';
import { LockedDbKey, LockedDbIds, BASE_TO_KEY, getLockedDbId } from '@/lib/lockedDbUtils';

export type { LockedDbKey, LockedDbIds };
export { getLockedDbId };

// The 6 locked databases every tenant must have
export const LOCKED_DB_BASES = [
    'db-invoices',
    'db-clients',
    'db-suppliers',
    'db-expenses',
    'db-tickets',
    'db-quotations',
] as const;

// Maps base ID → display name
const DB_NAMES: Record<string, string> = {
    'db-invoices':   'Sales Invoices',
    'db-clients':    'Contacts',
    'db-suppliers':  'Suppliers',
    'db-expenses':   'Purchase Invoices',
    'db-tickets':    'Expense Tickets',
    'db-quotations': 'Quotations',
};

/**
 * Provisions the 6 locked GlobalDatabase rows for a tenant.
 * Uses a Prisma transaction client if provided (for signup atomicity).
 * Safe to call multiple times — skips already-existing rows.
 *
 * Returns the full LockedDbIds map.
 */
export async function provisionLockedDatabases(
    tenantId: string,
    // Accept either the main prisma client or a transaction client
    db: Pick<PrismaClient, 'globalDatabase' | 'tenant'>
): Promise<LockedDbIds> {
    const suffix = tenantId.slice(0, 8);
    const ids: Partial<LockedDbIds> = {};

    for (const base of LOCKED_DB_BASES) {
        const scopedId = `${base}-${suffix}`;
        const key = BASE_TO_KEY[base];

        // Idempotent upsert — create only if not already there
        const existing = await db.globalDatabase.findUnique({
            where: { id: scopedId },
            select: { id: true },
        });

        if (!existing) {
            await db.globalDatabase.create({
                data: {
                    id: scopedId,
                    tenantId,
                    name: DB_NAMES[base] ?? base,
                    properties: [],
                    views: [],
                    activeFilters: [],
                    activeSorts: [],
                    isTemplate: false,
                    ownerId: 'system',
                },
            });
        }

        ids[key] = scopedId;
    }

    const lockedDbIds = ids as LockedDbIds;

    // Persist the map on the tenant row
    await db.tenant.update({
        where: { id: tenantId },
        data: { lockedDbIds },
    });

    return lockedDbIds;
}
