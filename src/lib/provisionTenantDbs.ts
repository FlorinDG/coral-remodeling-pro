/**
 * provisionTenantDbs.ts
 *
 * Creates the 6 locked GlobalDatabase rows for a new tenant and stores
 * their IDs in Tenant.lockedDbIds. Safe to call multiple times (idempotent).
 *
 * Each tenant gets uniquely-scoped IDs like:
 *   db-invoices-a1b2c3d4   (where a1b2c3d4 = first 8 chars of tenantId)
 *
 * Legacy tenants (FOUNDER) have lockedDbIds = {} and fall back to
 * bare IDs via getLockedDbId().
 */

import { PrismaClient } from '@prisma/client';

// The 6 locked databases every tenant must have
export const LOCKED_DB_BASES = [
    'db-invoices',
    'db-clients',
    'db-suppliers',
    'db-expenses',
    'db-tickets',
    'db-quotations',
] as const;

export type LockedDbKey = 'invoices' | 'clients' | 'suppliers' | 'expenses' | 'tickets' | 'quotations';

export type LockedDbIds = Record<LockedDbKey, string>;

// Maps base ID → display name
const DB_NAMES: Record<string, string> = {
    'db-invoices':   'Sales Invoices',
    'db-clients':    'Contacts',
    'db-suppliers':  'Suppliers',
    'db-expenses':   'Purchase Invoices',
    'db-tickets':    'Expense Tickets',
    'db-quotations': 'Quotations',
};

// Maps base ID → lockedDbIds key
const BASE_TO_KEY: Record<string, LockedDbKey> = {
    'db-invoices':   'invoices',
    'db-clients':    'clients',
    'db-suppliers':  'suppliers',
    'db-expenses':   'expenses',
    'db-tickets':    'tickets',
    'db-quotations': 'quotations',
};

/**
 * Returns the actual tenant-scoped DB ID for a given base name.
 * Falls back to the bare base ID for legacy tenants (lockedDbIds = {}).
 */
export function getLockedDbId(base: string, lockedDbIds: Record<string, string>): string {
    const key = BASE_TO_KEY[base];
    if (key && lockedDbIds[key]) return lockedDbIds[key];
    return base; // Legacy fallback — FOUNDER tenant bare IDs
}

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
