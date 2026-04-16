/**
 * src/lib/roles.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all role string constants.
 * Import from here everywhere — never hardcode role strings.
 * ─────────────────────────────────────────────────────────────────
 */

export const ROLES = {
    // ── Platform roles (Coral Group staff, no tenant context) ────────
    /** Full control over everything. */
    SUPERADMIN:                  'SUPERADMIN',
    /** Manages coral-sys.coral-group.be storefront + coral-group.be website. No ERP access. */
    FRONTSTORE_MANAGER:          'FRONTSTORE_MANAGER',
    /** Manages tenants via superadmin panel only. No ERP access. */
    TENANT_MANAGER:              'TENANT_MANAGER',

    // ── Workspace owner/admin ────────────────────────────────────────
    /** Migrated from TENANT_ADMIN. Full ERP access regardless of planType. */
    APP_MANAGER:                 'APP_MANAGER',

    // ── FREE tier micro-role (1 user max) ────────────────────────────
    /** Single-user workspace. Free-tier feature set. No sub-user management. */
    TENANT_FREE:                 'TENANT_FREE',

    // ── PRO tier micro-roles (3 users max: 1 owner + 2 employees) ────
    /** PRO workspace owner. Can invite/configure up to 2 TENANT_PRO_EMPLOYEE users. */
    TENANT_PRO_OWNER:            'TENANT_PRO_OWNER',
    /** PRO workspace employee. Configured by TENANT_PRO_OWNER. */
    TENANT_PRO_EMPLOYEE:         'TENANT_PRO_EMPLOYEE',

    // ── ENTERPRISE tier micro-roles ───────────────────────────────────
    /** Enterprise workspace owner. Full access. Manages all sub-roles. */
    TENANT_ENTERPRISE_OWNER:     'TENANT_ENTERPRISE_OWNER',
    /** Enterprise manager. Management-level access. */
    TENANT_ENTERPRISE_MANAGER:   'TENANT_ENTERPRISE_MANAGER',
    /** Enterprise employee. Standard access. */
    TENANT_ENTERPRISE_EMPLOYEE:  'TENANT_ENTERPRISE_EMPLOYEE',
    /** Enterprise workforce. Field/labour access. Most restricted. */
    TENANT_ENTERPRISE_WORKFORCE: 'TENANT_ENTERPRISE_WORKFORCE',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ── Helper sets (use in middleware + server actions) ─────────────────

/** Roles that can access /superadmin (platform admin panel). */
export const PLATFORM_ADMIN_ROLES: Role[] = [
    ROLES.SUPERADMIN,
    ROLES.TENANT_MANAGER,
];

/** Roles that can access /admin (ERP). */
export const ERP_ROLES: Role[] = [
    ROLES.SUPERADMIN,          // superadmin can also enter ERP for support
    ROLES.APP_MANAGER,
    ROLES.TENANT_FREE,
    ROLES.TENANT_PRO_OWNER,
    ROLES.TENANT_PRO_EMPLOYEE,
    ROLES.TENANT_ENTERPRISE_OWNER,
    ROLES.TENANT_ENTERPRISE_MANAGER,
    ROLES.TENANT_ENTERPRISE_EMPLOYEE,
    ROLES.TENANT_ENTERPRISE_WORKFORCE,
];

/** Roles that can manage their workspace's users. */
export const WORKSPACE_OWNER_ROLES: Role[] = [
    ROLES.APP_MANAGER,
    ROLES.TENANT_PRO_OWNER,
    ROLES.TENANT_ENTERPRISE_OWNER,
    ROLES.TENANT_ENTERPRISE_MANAGER,
];

// ── User count limits per plan (enforced at invite time) ─────────────

/** Maximum total users allowed per workspace by plan type. */
export const PLAN_USER_LIMITS: Record<string, number> = {
    FREE:       1,
    PRO:        3,   // 1 owner + 2 employees
    ENTERPRISE: Infinity, // TBD when enterprise tier is built
    FOUNDER:    Infinity,
    CUSTOM:     Infinity,
};
