/**
 * KERN-SCHEMA-1 · which system databases a tenant is ENTITLED to have structured (columns) — pure, tested.
 * Florin 2026-10-03: "filling database fields is tenant gated … free tier gets a quote engine that does not
 * store anything, and does not access articles and bestek. pro gets the empty library to populate".
 * feature_matrix.md: LIBRARY (articles + bestek) 🔒 FREE · ✅ PRO · ✅ ENTERPRISE · ✅ FOUNDER.
 *
 * This decides COLUMNS only. Rows (a pre-filled library) are never created here.
 */
import type { SystemDatabaseRole } from './system-databases';

const LIBRARY_PLANS = new Set(['PRO', 'ENTERPRISE', 'FOUNDER', 'CUSTOM']);

/** The module each role needs; 'LIBRARY' is derived from the plan (no module toggle exists for it). */
const REQUIRES: Partial<Record<SystemDatabaseRole, string>> = {
    invoices: 'INVOICING', suppliers: 'INVOICING', expenses: 'INVOICING', tickets: 'INVOICING',
    'payments-in': 'INVOICING', 'payments-out': 'INVOICING',
    clients: 'CRM', quotations: 'CRM', crm: 'CRM', bobex: 'CRM',
    projects: 'PROJECTS', tasks: 'TASKS',
    articles: 'LIBRARY', bestek: 'LIBRARY',
};

export function schemaEntitled(role: SystemDatabaseRole, planType: string | null | undefined, activeModules: string[]): boolean {
    const need = REQUIRES[role];
    if (!need) return false;                                   // journal, hr: no canonical schema to give
    if (need === 'LIBRARY') return LIBRARY_PLANS.has(String(planType || '').toUpperCase());
    return activeModules.includes(need);
}
