/**
 * lockedDbUtils.ts — CLIENT SAFE
 *
 * Pure utility functions for resolving per-tenant locked DB IDs.
 * No Prisma, no server dependencies. Safe to import from client components.
 */

export type LockedDbKey = 'invoices' | 'clients' | 'suppliers' | 'expenses' | 'tickets' | 'quotations';
export type LockedDbIds = Record<LockedDbKey, string>;

// Maps base locked DB name → the key used in Tenant.lockedDbIds JSON
export const BASE_TO_KEY: Record<string, LockedDbKey> = {
    'db-invoices':   'invoices',
    'db-clients':    'clients',
    'db-suppliers':  'suppliers',
    'db-expenses':   'expenses',
    'db-tickets':    'tickets',
    'db-quotations': 'quotations',
};

/**
 * Resolve a base locked DB name (e.g. 'db-invoices') to the tenant-scoped actual ID.
 * Falls back to the bare base ID for legacy tenants (lockedDbIds = {}).
 */
export function getLockedDbId(base: string, lockedDbIds: Record<string, string>): string {
    const key = BASE_TO_KEY[base];
    if (key && lockedDbIds[key]) return lockedDbIds[key];
    return base; // Legacy FOUNDER fallback — bare IDs still work
}
