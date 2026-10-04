/**
 * system-databases.ts — KERNEL (L0)
 *
 * The single canonical vocabulary and specification table for system databases.
 * Pure definitions: NO Prisma imports, NO server dependencies, CLIENT SAFE.
 * Governed by coral-kernel-system-databases.md, coral-id-parsing-decomposition.md, and KERN-6.
 */

export const SYSTEM_DATABASE_ROLES = [
    'invoices',
    'clients',
    'suppliers',
    'expenses',
    'tickets',
    'quotations',
    'payments-in',
    'payments-out',
    'projects',
    'tasks',
    'articles',
    'crm',
    'bobex',
    'bestek',
    'journal-general',
    'hr',
] as const;

export type SystemDatabaseRole = typeof SYSTEM_DATABASE_ROLES[number];

export interface SystemDatabaseSpec {
    role: SystemDatabaseRole;
    /**
     * DATA-COMPATIBILITY ONLY.
     * It exists to read values written before the binding existed ('db-1', 'db-clients').
     * Nothing may construct an id from it.
     */
    legacyBase: string;
    displayName: string;
    /**
     * Entitlement gate module name (e.g. 'INVOICING', 'CRM'), or explicit null if ungated.
     * 'LIBRARY' is not a module toggle: it is derived from the plan (PRO and up — Florin 2026-10-03).
     * Read ONLY through systemDatabaseEntitled() (system-schema-entitlement.ts) — never compared here and there.
     * ENT-6 (2026-10-04): projects, tasks, articles, crm, bobex, bestek and hr were null, so a FREE tenant
     * could create in them; journal-general stays ungated until the Journal decision.
     */
    module: string | null;
}

export const SYSTEM_DATABASES: Readonly<Record<SystemDatabaseRole, SystemDatabaseSpec>> = {
    'invoices': {
        role:        'invoices',
        legacyBase:  'db-invoices',
        displayName: 'Sales Invoices',
        module:      'INVOICING',
    },
    'clients': {
        role:        'clients',
        legacyBase:  'db-clients',
        displayName: 'Contacts',
        module:      'CRM',
    },
    'suppliers': {
        role:        'suppliers',
        legacyBase:  'db-suppliers',
        displayName: 'Suppliers',
        module:      'INVOICING',
    },
    'expenses': {
        role:        'expenses',
        legacyBase:  'db-expenses',
        displayName: 'Purchase Invoices',
        module:      'INVOICING',
    },
    'tickets': {
        role:        'tickets',
        legacyBase:  'db-tickets',
        displayName: 'Expense Tickets',
        module:      'INVOICING',
    },
    'quotations': {
        role:        'quotations',
        legacyBase:  'db-quotations',
        displayName: 'Quotations',
        module:      'CRM',
    },
    'payments-in': {
        role:        'payments-in',
        legacyBase:  'db-payments-in',
        displayName: 'Received Payments',
        module:      'INVOICING',
    },
    'payments-out': {
        role:        'payments-out',
        legacyBase:  'db-payments-out',
        displayName: 'Paid Payments',
        module:      'INVOICING',
    },
    'projects': {
        role:        'projects',
        legacyBase:  'db-1',
        displayName: 'Projects',
        module:      'PROJECTS',
    },
    'tasks': {
        role:        'tasks',
        legacyBase:  'db-tasks',
        displayName: 'Tasks',
        module:      'TASKS',
    },
    'articles': {
        role:        'articles',
        legacyBase:  'db-articles',
        displayName: 'Material Articles',
        module:      'LIBRARY',
    },
    'crm': {
        role:        'crm',
        legacyBase:  'db-crm',
        displayName: 'CRM',
        module:      'CRM',
    },
    'bobex': {
        role:        'bobex',
        legacyBase:  'db-bobex',
        displayName: 'Bobex',
        module:      'CRM',
    },
    'bestek': {
        role:        'bestek',
        legacyBase:  'db-bestek',
        displayName: 'Bestek Templates',
        module:      'LIBRARY',
    },
    'journal-general': {
        role:        'journal-general',
        legacyBase:  'db-journal-general',
        displayName: 'General Journal',
        module:      null,
    },
    'hr': {
        role:        'hr',
        legacyBase:  'db-hr',
        displayName: 'HR',
        module:      'HR',
    },
} as const;

// ── Derived List 1: Role → Display Name map ──────────────────────────────────
export const SYSTEM_DATABASE_NAMES: Record<SystemDatabaseRole, string> = Object.fromEntries(
    SYSTEM_DATABASE_ROLES.map(role => [role, SYSTEM_DATABASES[role].displayName])
) as Record<SystemDatabaseRole, string>;

// ── Derived List 2: Legacy Base ID → Role (BASE_TO_KEY) ──────────────────────
export const BASE_TO_KEY: Record<string, SystemDatabaseRole> = Object.fromEntries(
    SYSTEM_DATABASE_ROLES.map(role => [SYSTEM_DATABASES[role].legacyBase, role])
);

// ── Derived List 3: Immutable Base Prefixes (SYSTEM_DB_PREFIXES) ─────────────
// Gains db-journal-general and db-hr (14 → 16).
export const SYSTEM_DB_PREFIXES: readonly string[] = SYSTEM_DATABASE_ROLES.map(
    role => SYSTEM_DATABASES[role].legacyBase
);

// ── Derived List 4: Server Provisioned Bases (SERVER_PROVISIONED_BASES) ───────
// Pass 1 provisions all 16 roles; Set is updated from 8 → 16.
export const SERVER_PROVISIONED_BASES: Set<string> = new Set(
    SYSTEM_DATABASE_ROLES.map(role => SYSTEM_DATABASES[role].legacyBase)
);

// ── Derived List 5: Module Entitlement Map (DB_ID_MODULE_MAP) ─────────────────
// Explicit module gate (or null) for all 16 roles.
export const DB_ID_MODULE_MAP: Array<[string, string | null]> = SYSTEM_DATABASE_ROLES.map(
    role => [SYSTEM_DATABASES[role].legacyBase, SYSTEM_DATABASES[role].module]
);

// ── R1-2 · ONE CANONICAL RESOLVER, FAIL-CLOSED ─────────────────────────────────
/**
 * A system database was asked for, and this tenant has no binding for it. That is a PROVISIONING
 * defect and it surfaces as one (ERROR-SURFACING) — never as a guess. The guess it replaces
 * (getLockedDbId) invented `${base}-${suffix}` from a sibling's id, or returned the bare base id —
 * which is Florin's own tenant's database for a tenant whose map was empty.
 */
export class UnboundSystemDatabaseError extends Error {
    readonly base: string;
    readonly role: SystemDatabaseRole;
    constructor(base: string, role: SystemDatabaseRole) {
        super(`unbound_system_database: this tenant has no binding for "${role}" (${base}) — a provisioning defect`);
        this.name = 'UnboundSystemDatabaseError';
        this.base = base;
        this.role = role;
    }
}

/**
 * The forward binding, READ — nothing inferred (pd.md: "an id is never parsed; the binding is read").
 *   - a system base ('db-invoices') → this tenant's bound id, or THROW;
 *   - anything else (an already-bound id, a minted custom database id) → returned unchanged.
 *     Ownership of a supplied id is verified server-side (R1-3), not guessed here.
 */
export function resolveDatabaseId(idOrBase: string, lockedDbIds: Partial<Record<string, string>>): string {
    const role = BASE_TO_KEY[idOrBase];
    if (!role) return idOrBase;
    const bound = lockedDbIds[role];
    if (!bound) throw new UnboundSystemDatabaseError(idOrBase, role);
    return bound;
}
