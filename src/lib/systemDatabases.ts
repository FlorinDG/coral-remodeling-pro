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

/** Base IDs of system databases with immutable schemas. */
export const SYSTEM_DB_PREFIXES = [
    'db-clients',
    'db-suppliers',
    'db-invoices',
    'db-expenses',
    'db-tickets',
    'db-quotations',
    'db-1',       // Projects
    'db-tasks',   // Project Tasks
] as const;

/**
 * Check if a database ID belongs to a system database.
 * Handles both bare IDs (e.g. 'db-clients') and tenant-scoped IDs
 * (e.g. 'db-clients-abc12345').
 */
export function isSystemDatabase(id: string): boolean {
    return SYSTEM_DB_PREFIXES.some(prefix => id === prefix || id.startsWith(prefix + '-'));
}
