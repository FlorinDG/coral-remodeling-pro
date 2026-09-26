/**
 * systemDatabases.ts — CLIENT SAFE
 *
 * Single source of truth for system database identifiers.
 * System databases have immutable schemas — no add/delete/rename/type-change
 * for any tenant or plan tier. Only superadmin can modify these via the
 * superadmin panel (not through the regular database UI).
 *
 * This list must be kept in sync with:
 *   - DatabaseClone.tsx → isLockedSchemaDB
 *   - DatabaseClone.tsx → DEFAULT_PROPERTIES_MAP
 */

import {
    SYSTEM_DB_PREFIXES,
    SERVER_PROVISIONED_BASES,
} from '@/lib/kernel/system-databases';

export { SYSTEM_DB_PREFIXES, SERVER_PROVISIONED_BASES };

/**
 * Check if a database ID belongs to a system database.
 * Handles both bare IDs (e.g. 'db-clients') and tenant-scoped IDs
 * (e.g. 'db-clients-abc12345').
 */
export function isSystemDatabase(id: string): boolean {
    return SYSTEM_DB_PREFIXES.some(prefix => id === prefix || id.startsWith(prefix + '-'));
}

/**
 * Returns the base DB prefix for a given ID (strips tenant suffix).
 * e.g. 'db-clients-abc123' → 'db-clients'
 */
export function getBaseDbId(id: string): string {
    for (const prefix of SYSTEM_DB_PREFIXES) {
        if (id === prefix || id.startsWith(prefix + '-')) return prefix;
    }
    return id;
}

