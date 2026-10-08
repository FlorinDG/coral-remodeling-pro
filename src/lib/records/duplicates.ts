/**
 * DUP-1 · is this purchase document (ticket, purchase invoice) the same as one already there? Pure, tested
 * (tests/duplicates.test.ts). Florin 2026-10-08: "the to validate and the receipts need duplicate scanning / warning /
 * handling (this one is manual)" — the rule only FLAGS; a person decides (lib/records/validation refuses approval while
 * a flag stands; the editor offers keep / delete).
 *
 * Facts are read through the purchase editor's view (purchase-document.purchaseView), so a ticket and an invoice are
 * compared on the same names: supplier (VAT number first, else name), document date, total incl. VAT, and — for a
 * purchase invoice — its number (the record's title).
 * Replaces lib/expense-dedup.ts, which matched an `invoiceNumber` field no scan ever writes (the number is the title):
 * an exact duplicate invoice was never recognised.
 */
import { purchaseView } from './purchase-document';

type Props = Record<string, unknown>;

/** The record field the flag is stored in (kernel: a relation to the same database). */
export const DUPLICATE_FIELD = 'duplicateOf';
/** The review reason a flagged record carries in "Te valideren". */
export const DUPLICATE_REASON = 'Mogelijk duplicaat';

export type DuplicateStrength = 'duplicate' | 'possible';
export interface DuplicateMatch { id: string; strength: DuplicateStrength; fields: string[] }

/** Where the facts live per kind of record — for the door's candidate query (same fields purchaseView reads). */
export const DUPLICATE_QUERY_FIELDS: Readonly<Record<string, { date: string; amount: string }>> = {
    tickets: { date: 'date', amount: 'amount' },
    expenses: { date: 'invoiceDate', amount: 'totalIncVat' },
};

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const ymd = (v: unknown) => String(v ?? '').slice(0, 10);
const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) && n !== 0 ? Math.round(n * 100) / 100 : null;
};

interface Facts { supplier: string; vat: string; date: string; amount: number | null; number: string }

function facts(role: string, props: Props): Facts {
    const v = purchaseView(role, props);
    return {
        supplier: norm(v.supplierName),
        vat: norm(v.supplierVat).replace(/[^a-z0-9]/g, ''),
        date: ymd(v.invoiceDate),
        amount: num(v.totalIncVat),
        number: role === 'expenses' ? norm(v.title) : '',
    };
}

/** How one record matches another (null = not the same). */
export function compareDuplicate(role: string, a: Props, b: Props): { strength: DuplicateStrength; fields: string[] } | null {
    const x = facts(role, a), y = facts(role, b);
    const fields: string[] = [];
    const sameSupplier = (x.vat && y.vat) ? x.vat === y.vat : (!!x.supplier && x.supplier === y.supplier);
    if (sameSupplier) fields.push('leverancier');
    if (x.date && x.date === y.date) fields.push('datum');
    if (x.amount !== null && x.amount === y.amount) fields.push('bedrag');
    const sameNumber = !!x.number && x.number === y.number;
    if (sameNumber) fields.push('nummer');

    const has = (f: string) => fields.includes(f);
    // The same: one supplier's same number, or the same supplier, day and amount
    if ((sameSupplier && sameNumber) || (has('leverancier') && has('datum') && has('bedrag'))) return { strength: 'duplicate', fields };
    // Worth a look: the same amount on the same day or from the same supplier, or the same number
    if ((has('bedrag') && (has('datum') || has('leverancier'))) || sameNumber) return { strength: 'possible', fields };
    return null;
}

/** Every record the candidate may duplicate — the strongest first. The candidate itself never matches. */
export function findDuplicates(role: string, candidate: { id?: string; properties: Props }, others: Array<{ id: string; properties: Props }>): DuplicateMatch[] {
    const out: DuplicateMatch[] = [];
    for (const o of others) {
        if (candidate.id && o.id === candidate.id) continue;
        const m = compareDuplicate(role, candidate.properties, o.properties);
        if (m) out.push({ id: o.id, ...m });
    }
    return out.sort((p, q) => (p.strength === q.strength ? q.fields.length - p.fields.length : p.strength === 'duplicate' ? -1 : 1));
}

/** The flag a scan writes onto a record that may duplicate others (empty object = nothing to flag). */
export function duplicateFlag(matches: DuplicateMatch[]): Props {
    if (!matches.length) return {};
    const best = matches[0];
    return {
        [DUPLICATE_FIELD]: matches.map(m => m.id),
        reviewStatus: 'Na te kijken',
        reviewReason: `${DUPLICATE_REASON} (${best.fields.join(', ')})`,
    };
}

/** Whether a record still carries an unresolved duplicate flag (approval waits for a person). */
export function hasDuplicateFlag(props: Props | null | undefined): boolean {
    const v = (props || {})[DUPLICATE_FIELD];
    return Array.isArray(v) ? v.length > 0 : !!v;
}

/** "Geen duplicaat — behouden": the flag and its reason go; any other reason stays. */
export function clearDuplicateFlag(props: Props): Props {
    const reason = String(props.reviewReason ?? '');
    return { [DUPLICATE_FIELD]: [], ...(reason.startsWith(DUPLICATE_REASON) ? { reviewReason: '' } : {}) };
}
