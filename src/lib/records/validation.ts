/**
 * VALIDATE-1 · a scanned document COUNTS only once a person validated it (Florin 2026-10-06, after Billit's
 * antechamber: "fresh receipt scans don't reach the expenses db directly"). Pure, tested (tests/validation.test.ts).
 *
 * ONE rule for every consumer — the accountant export, the dashboard, project costs, the expense screens (each had its
 * own inline check; the export had none and would have exported an unread "Expense / €0" ticket).
 *   validated:  approved ("Goedgekeurd") · a record that never needed validation (manual entry, older records:
 *               no review status) · a PEPPOL arrival (Florin: compliance is checked at network level before it is
 *               sent — "literally 0 room for error … software agnostic")
 *   to validate: a scan / import with any other review status ("In verwerking", "Na te kijken", "Klaar", "Mislukt")
 * Approving requires the essentials (approveRefusal) — the door refuses an incomplete approval.
 */
import { hasDuplicateFlag, DUPLICATE_FIELD } from './duplicates';
type Props = Record<string, unknown>;

export const REVIEW_PROCESSING = 'In verwerking';
export const REVIEW_TO_CHECK = 'Na te kijken';
export const REVIEW_READY = 'Klaar';
export const REVIEW_APPROVED = 'Goedgekeurd';
export const SOURCE_PEPPOL = 'src-peppol';

export function isValidated(props: Props | null | undefined): boolean {
    const p = props || {};
    if (p.source === SOURCE_PEPPOL) return true;
    const s = p.reviewStatus;
    return s === undefined || s === null || s === '' || s === REVIEW_APPROVED;
}


const filled = (v: unknown) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
const amount = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN);

/**
 * Why this record may NOT be approved yet — the missing / wrong fields (field ids), or null.
 * tickets: merchant, date, a non-zero amount · purchase invoices: supplier, invoice date, a non-zero total, and
 * excl. + VAT = incl. when all three are there.
 */
export function approveRefusal(role: string | null | undefined, props: Props | null | undefined): string[] | null {
    const p = props || {};
    const out: string[] = [];
    if (role === 'tickets') {
        if (!filled(p.title) || p.title === 'Expense') out.push('title');
        if (!filled(p.date)) out.push('date');
        const a = amount(p.amount);
        if (!Number.isFinite(a) || a === 0) out.push('amount');
    } else if (role === 'expenses') {
        if (!filled(p.supplier) && !filled(p.supplierName)) out.push('supplier');
        if (!filled(p.invoiceDate)) out.push('invoiceDate');
        const inc = amount(p.totalIncVat), ex = amount(p.totalExVat), vat = amount(p.totalVat);
        if (!Number.isFinite(inc) || inc === 0) out.push('totalIncVat');
        else if (Number.isFinite(ex) && Number.isFinite(vat) && Math.abs(ex + vat - inc) >= 0.05) out.push('totalVat');
    }
    // DUP-1: a possible duplicate waits for a person — keep it (clear the flag) or delete it, then approve
    if ((role === 'tickets' || role === 'expenses') && hasDuplicateFlag(p)) out.push(DUPLICATE_FIELD);
    return out.length ? out : null;
}

/** Bulk "Goedkeuren" on the "Te valideren" screen: who can be approved now, and what each other one still lacks. */
export function approvalPlan(role: string | null | undefined, rows: Array<{ id: string; properties: Props }>):
    { approve: string[]; refused: Array<{ id: string; missing: string[] }> } {
    const approve: string[] = [], refused: Array<{ id: string; missing: string[] }> = [];
    for (const r of rows) {
        if (isValidated(r.properties)) continue;                       // already counts — nothing to do
        const missing = approveRefusal(role, r.properties);
        if (missing) refused.push({ id: r.id, missing }); else approve.push(r.id);
    }
    return { approve, refused };
}
