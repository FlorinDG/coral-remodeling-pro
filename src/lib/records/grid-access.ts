/**
 * Who may change records in a database grid — pure, tested (tests/grid-access.test.ts). ONE rule for both grids
 * (the old grid held it inline: isAccountant / isBestekReadOnly). DB-HEADER-1 reuses it for the toolbar.
 *   - the accountant reads (an accountant edits nothing — the export locks are theirs to rely on);
 *   - the bestek is read-only below ENTERPRISE (the shipped library — Florin: PRO starts empty, fills are bought);
 *   - `preventDelete` (a screen's own row guard, e.g. invoices past draft) still applies per row; the server door
 *     refuses an issued document regardless.
 */
export interface GridAccess { edit: boolean; create: boolean; delete: boolean }

export function gridAccess(ctx: { userRole?: string | null; logicalKey?: string | null; isEnterprise: boolean }): GridAccess {
    if (ctx.userRole === 'ACCOUNTANT') return { edit: false, create: false, delete: false };
    if (ctx.logicalKey === 'bestek' && !ctx.isEnterprise) return { edit: false, create: false, delete: false };
    return { edit: true, create: true, delete: true };
}
