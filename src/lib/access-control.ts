/**
 * src/lib/access-control.ts
 * ─────────────────────────────────────────────────────────────────
 * Centralised RBAC helpers for per-module, per-user data access.
 *
 * Access levels (set by tenant admin per user per module):
 *   ALL              — see every record in the module
 *   OWN              — see only records created by this user (DEFAULT)
 *   ASSIGNED_AND_OWN — see own + records explicitly assigned to this user
 *   NONE             — module hidden entirely
 *
 * Workspace owners / managers always resolve to ALL.
 * Workforce role gets OWN on HR/TASKS, NONE elsewhere (override-able).
 * ─────────────────────────────────────────────────────────────────
 */

import { WORKSPACE_OWNER_ROLES, ROLES } from './roles';

export type AccessLevel = 'ALL' | 'OWN' | 'ASSIGNED_AND_OWN' | 'NONE';

// Modules that workforce can access by default (everything else = NONE)
const WORKFORCE_DEFAULT_MODULES: Record<string, AccessLevel> = {
    HR: 'OWN',
    TASKS: 'ASSIGNED_AND_OWN', // can see tasks assigned to them
};

/**
 * Resolve the effective access level for a user + module combination.
 */
export function getModuleAccess(
    user: { moduleAccess?: Record<string, string> | null; role?: string },
    module: string,
): AccessLevel {
    const role = user.role ?? '';

    // Owners/admins always get ALL
    if (WORKSPACE_OWNER_ROLES.includes(role as typeof WORKSPACE_OWNER_ROLES[number])) {
        return 'ALL';
    }

    // Workforce: restricted defaults unless explicitly overridden
    if (role === ROLES.TENANT_ENTERPRISE_WORKFORCE) {
        const override = (user.moduleAccess as Record<string, string> | null)?.[module];
        if (override && isValidAccessLevel(override)) return override as AccessLevel;
        return WORKFORCE_DEFAULT_MODULES[module] ?? 'NONE';
    }

    // Regular users: read from moduleAccess, default OWN
    const level = (user.moduleAccess as Record<string, string> | null)?.[module];
    if (level && isValidAccessLevel(level)) return level as AccessLevel;
    return 'OWN';
}

/**
 * Build a Prisma `where` filter clause based on access level.
 *
 * @param accessLevel — resolved via getModuleAccess()
 * @param userId      — the current user's ID
 * @returns A partial Prisma where clause to spread into your query.
 * @throws  if accessLevel is NONE.
 *
 * Usage:
 *   const filter = buildAccessFilter(access, userId);
 *   const records = await prisma.globalPage.findMany({
 *       where: { databaseId: dbId, ...filter },
 *   });
 */
export function buildAccessFilter(
    accessLevel: AccessLevel,
    userId: string,
): Record<string, unknown> {
    switch (accessLevel) {
        case 'ALL':
            return {};
        case 'OWN':
            return { createdBy: userId };
        case 'ASSIGNED_AND_OWN':
            return { OR: [{ createdBy: userId }, { assignedTo: { has: userId } }] };
        case 'NONE':
            throw Object.assign(
                new Error('ACCESS_DENIED'),
                { code: 'ACCESS_DENIED', module: 'unknown', userId },
            );
    }
}

/**
 * Check whether a specific user can view a specific record.
 * Useful for detail pages where you already have the record loaded.
 */
export function canViewRecord(
    accessLevel: AccessLevel,
    userId: string,
    record: { createdBy?: string; assignedTo?: string[] },
): boolean {
    switch (accessLevel) {
        case 'ALL':
            return true;
        case 'OWN':
            return record.createdBy === userId;
        case 'ASSIGNED_AND_OWN':
            return record.createdBy === userId || (record.assignedTo ?? []).includes(userId);
        case 'NONE':
            return false;
    }
}

/**
 * Check whether a user can perform destructive actions (delete, archive)
 * on a record. Workforce can never delete/archive.
 */
export function canDeleteRecord(role: string, accessLevel: AccessLevel): boolean {
    if (role === ROLES.TENANT_ENTERPRISE_WORKFORCE) return false;
    return accessLevel === 'ALL' || accessLevel === 'OWN';
}

/**
 * Check whether a user can change assignment on a record.
 * Workforce cannot reassign.
 */
export function canReassign(role: string): boolean {
    if (role === ROLES.TENANT_ENTERPRISE_WORKFORCE) return false;
    return true;
}

// ── Internal ────────────────────────────────────────────────────────────────

function isValidAccessLevel(value: string): value is AccessLevel {
    return ['ALL', 'OWN', 'ASSIGNED_AND_OWN', 'NONE'].includes(value);
}
