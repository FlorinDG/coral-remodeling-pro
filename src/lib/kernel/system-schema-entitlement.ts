/**
 * Which system databases a tenant MAY USE — one rule, pure, tested (tests/system-schema-entitlement.test.ts).
 * Read by the column reconcile (KERN-SCHEMA-1: no columns where the plan does not reach) and by the
 * create door (createPageServerFirst, ENT-6: no rows either).
 *
 * Florin 2026-10-03: "free tier doesn't even get the db's. at all" — FREE: invoicing only; PRO: the empty
 * library; feature_matrix.md: LIBRARY (articles + bestek) 🔒 FREE · ✅ PRO · ✅ ENTERPRISE · ✅ FOUNDER.
 *
 * The module of each database lives in ONE place: SYSTEM_DATABASES[role].module. This file only reads it.
 */
import { SYSTEM_DATABASES, type SystemDatabaseRole } from './system-databases';

const LIBRARY_PLANS = new Set(['PRO', 'ENTERPRISE', 'FOUNDER', 'CUSTOM']);

export function systemDatabaseEntitled(role: SystemDatabaseRole, planType: string | null | undefined, activeModules: string[]): boolean {
    const spec = SYSTEM_DATABASES[role];
    if (!spec) return false;                                   // unknown role: refuse, never guess
    const need = spec.module;
    if (need === null) return true;                            // explicitly ungated (journal-general)
    if (need === 'LIBRARY') return LIBRARY_PLANS.has(String(planType || '').toUpperCase());
    return activeModules.includes(need);
}
