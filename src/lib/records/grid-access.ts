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

/**
 * The purchase-invoice inbox: bulk approval takes only records the reading marked "Klaar" (the others need a person
 * first). Approving writes ONE field per record (reviewStatus → 'Goedgekeurd').
 */
export const REVIEW_READY = 'Klaar';
export const REVIEW_APPROVED = 'Goedgekeurd';
export const EXPENSES_INBOX_VIEW = 'vw-expenses-inbox';

export function bulkApproveCheck(rows: Array<{ id: string; properties: Record<string, unknown> }>): { ok: true; ids: string[] } | { ok: false; notReady: string[] } {
    const notReady = rows.filter(r => r.properties.reviewStatus !== REVIEW_READY).map(r => r.id);
    return notReady.length ? { ok: false, notReady } : { ok: true, ids: rows.map(r => r.id) };
}

/** Columns a plan does not show: "Lead source" on contacts without the CRM module (the old grid's licensing rule). */
export function licensedColumns<P extends { name?: string }>(props: P[], ctx: { logicalKey?: string | null; hasCRM: boolean }): P[] {
    if (ctx.hasCRM || ctx.logicalKey !== 'clients') return props;
    return props.filter(p => (p.name || '').toLowerCase() !== 'lead source');
}
