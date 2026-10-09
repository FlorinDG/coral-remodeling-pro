/**
 * DOC-LINES-2 · the VAT regimes of a sales document (quote / invoice / proforma / credit note) — the ONE list. Pure.
 *
 * A document has a regime: a rate (21 / 12 / 6 / 0) or reverse charge (medecontractant — the whole document at 0,
 * category AE). Its lines take that rate by default; a line's rate set by hand is its own (lib/records/document-lines
 * `vatRateOverride`). Florin 2026-10-09: "VAT has to have a default, and it must be the set regime for the lines."
 */
/** The Belgian VAT rates — sales documents choose from them, purchase documents state them. */
export const VAT_RATES = [21, 12, 6, 0] as const;
export type VatRate = typeof VAT_RATES[number];

export const REVERSE_CHARGE = 'medecontractant';
/** The regimes a document can choose, in display order. */
export const SALES_VAT_REGIMES: readonly string[] = [...VAT_RATES.map(String), REVERSE_CHARGE];
/** A document without a regime is at the standard rate. */
export const DEFAULT_VAT_REGIME = '21';

export function isReverseCharge(regime: string | null | undefined): boolean {
    return regime === REVERSE_CHARGE;
}

/** The rate a regime applies: reverse charge → 0; a rate → itself; nothing / unreadable → the default. */
export function documentRateOf(regime: string | null | undefined): number {
    if (isReverseCharge(regime)) return 0;
    const r = parseFloat(regime || DEFAULT_VAT_REGIME);
    return Number.isFinite(r) ? r : parseFloat(DEFAULT_VAT_REGIME);
}
