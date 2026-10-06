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
 * The old purchase-invoice inbox VIEW. VALIDATE-1 replaced it by the "Te valideren" SCREEN (lib/records/validation:
 * isValidated / approvalPlan); the id stays known so the header rule and old views keep resolving.
 */
export const EXPENSES_INBOX_VIEW = 'vw-expenses-inbox';

/** Columns a plan does not show: "Lead source" on contacts without the CRM module (the old grid's licensing rule). */
export function licensedColumns<P extends { name?: string }>(props: P[], ctx: { logicalKey?: string | null; hasCRM: boolean }): P[] {
    if (ctx.hasCRM || ctx.logicalKey !== 'clients') return props;
    return props.filter(p => (p.name || '').toLowerCase() !== 'lead source');
}

/**
 * "Duplicate" a record from the grid — or null where a copy must not be made here. Documents (invoices, quotations,
 * purchase invoices, payments) are never duplicated in the grid: a copy carried the status (sent), the structured
 * payment reference and the accountant-export stamp — a second invoice with the same OGM. Their editors have their
 * own copy flows. Other records: everything but stamps and the computed comments field; the title marked "(kopie)".
 */
const NO_GRID_DUPLICATE: ReadonlySet<string> = new Set(['invoices', 'quotations', 'expenses', 'payments-in', 'payments-out', 'tickets']);
const STAMPS = /^(accountantExported|peppol|structuredComm$|sentAt$|lastSentAt$|signedAt$|clientSignature$|acceptedAt$|rejectedAt$|receiptUrl$|comments$)/;

/** A field that records what HAPPENED to one document (sent, signed, exported, its OGM…) — never copied to another. */
export function isStampField(fieldId: string): boolean {
    return STAMPS.test(fieldId);
}

export function duplicateProperties(logicalKey: string | null | undefined, props: Record<string, unknown>): Record<string, unknown> | null {
    if (logicalKey && NO_GRID_DUPLICATE.has(logicalKey)) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) if (!isStampField(k)) out[k] = v;
    if (typeof out.title === 'string' && out.title) out.title = `${out.title} (kopie)`;
    return out;
}
