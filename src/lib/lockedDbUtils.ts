/**
 * lockedDbUtils.ts — CLIENT SAFE
 *
 * Pure utility functions for resolving per-tenant locked DB IDs.
 * No Prisma, no server dependencies. Safe to import from client components.
 */

export type LockedDbKey = 'invoices' | 'clients' | 'suppliers' | 'expenses' | 'tickets' | 'quotations' | 'payments-in' | 'payments-out' | 'projects' | 'tasks' | 'articles' | 'crm' | 'bobex' | 'bestek' | 'journal-general' | 'hr';
export type LockedDbIds = Partial<Record<LockedDbKey, string>>;

// Maps base locked DB name → the key used in Tenant.lockedDbIds JSON
export const BASE_TO_KEY: Record<string, LockedDbKey> = {
    'db-invoices':     'invoices',
    'db-clients':      'clients',
    'db-suppliers':    'suppliers',
    'db-expenses':     'expenses',
    'db-tickets':      'tickets',
    'db-quotations':   'quotations',
    'db-payments-in':  'payments-in',
    'db-payments-out': 'payments-out',
    'db-1':            'projects',
    'db-tasks':        'tasks',
    'db-articles':     'articles',
    'db-crm':          'crm',
    'db-bobex':        'bobex',
    'db-bestek':       'bestek',
    'db-journal-general': 'journal-general',
    'db-hr':           'hr',
};

/**
 * Resolve a base locked DB name (e.g. 'db-invoices') to the tenant-scoped actual ID.
 * Falls back to the bare base ID for legacy tenants (lockedDbIds = {}).
 */
export function getLockedDbId(base: string, lockedDbIds: Record<string, string>): string {
    const key = BASE_TO_KEY[base];
    if (key && lockedDbIds[key]) return lockedDbIds[key];
    
    // Self-healing fallback for new system databases not yet in legacy tenant's lockedDbIds:
    // Extract the tenant suffix from an existing mapped DB (e.g. 'db-invoices-abc12345' -> 'abc12345')
    // and append it to the base ID to keep it properly tenant-isolated.
    const anyMappedVal = Object.values(lockedDbIds).find(val => val.includes('-'));
    if (anyMappedVal) {
        const parts = anyMappedVal.split('-');
        const suffix = parts[parts.length - 1];
        if (suffix) {
            return `${base}-${suffix}`;
        }
    }
    
    return base; // Legacy FOUNDER fallback — bare IDs still work
}
