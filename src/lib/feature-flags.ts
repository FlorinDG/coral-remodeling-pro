/**
 * src/lib/feature-flags.ts
 * ─────────────────────────────────────────────────────────────────
 * Feature-flag engine — single source of truth for what each plan
 * tier can access. Import canAccess() everywhere instead of
 * checking planType directly.
 *
 * Usage:
 *   import { canAccess } from '@/lib/feature-flags';
 *   const canUseLibrary = canAccess('QUOTATION_LIBRARY_SEARCH', tenant.planType);
 * ─────────────────────────────────────────────────────────────────
 */

const TIER_ORDER = ['FREE', 'PRO', 'ENTERPRISE'] as const;
type Tier = typeof TIER_ORDER[number];

/**
 * Feature flags — add new flags here as features are built.
 * minTier: minimum plan tier required to access the feature.
 * FOUNDER and CUSTOM always bypass all gates.
 */
export const FEATURE_FLAGS = {
    // ── Quotation engine ─────────────────────────────────────────────
    /** Article library autocomplete while typing line items */
    QUOTATION_LIBRARY_SEARCH:       { minTier: 'PRO'         as Tier },
    /** "Save to Library" / "Update Library" buttons per row */
    QUOTATION_SAVE_TO_LIBRARY:      { minTier: 'PRO'         as Tier },
    /** PDF import with direct library injection option */
    QUOTATION_PDF_IMPORT_LIBRARY:   { minTier: 'PRO'         as Tier },
    /** Duplicate-line detection during PDF import (flags & pre-deselects existing content) */
    QUOTATION_PDF_IMPORT_DEDUP:     { minTier: 'PRO'         as Tier },

    // ── Peppol (volume enforced separately in plan-limits.ts) ────────
    /** Send Peppol invoices (5/month hard cap on FREE) */
    PEPPOL_SEND:                    { minTier: 'FREE'        as Tier },
    /** Receive Peppol invoices (10/month soft cap on FREE) */
    PEPPOL_RECEIVE:                 { minTier: 'FREE'        as Tier },

    // ── Branding ─────────────────────────────────────────────────────
    /** Remove "Powered by CoralOS" branding from client-facing docs */
    WHITELABEL:                     { minTier: 'ENTERPRISE'  as Tier },

    // ── Workspace user management ────────────────────────────────────
    /** Invite and manage workspace users (PRO: max 3, Enterprise: TBD) */
    WORKSPACE_USER_MANAGEMENT:      { minTier: 'PRO'         as Tier },

    // ── CRM ──────────────────────────────────────────────────────────
    /** Full CRM pipeline with stages and automation */
    CRM_PIPELINE:                   { minTier: 'PRO'         as Tier },

    // ── Projects ─────────────────────────────────────────────────────
    /** Gantt / planning timeline view */
    PROJECTS_GANTT:                 { minTier: 'PRO'         as Tier },
    /** Project budget tracking and margin analytics */
    PROJECTS_BUDGET:                { minTier: 'ENTERPRISE'  as Tier },

    // ── HR ───────────────────────────────────────────────────────────
    /** HR contracts and advanced workforce management */
    HR_CONTRACTS:                   { minTier: 'ENTERPRISE'  as Tier },
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check whether a given plan tier has access to a feature.
 * - FOUNDER and CUSTOM: always true (bypass all gates)
 * - FREE / PRO / ENTERPRISE: compared against minTier
 * - Unknown plan type: returns false (safe default)
 */
export function canAccess(flag: FeatureFlag, planType: string): boolean {
    // Unlimited plans bypass all gates
    if (planType === 'FOUNDER' || planType === 'CUSTOM') return true;

    const required = TIER_ORDER.indexOf(FEATURE_FLAGS[flag].minTier);
    const actual   = TIER_ORDER.indexOf(planType as Tier);

    // Unknown planType → deny
    if (actual === -1) return false;

    return actual >= required;
}
