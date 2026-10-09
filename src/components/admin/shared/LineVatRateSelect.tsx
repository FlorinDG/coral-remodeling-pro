"use client";
/**
 * DOC-LINES-2 · a line's VAT rate (Florin 2026-10-09: mixed rates — "yes"). Empty = the document's rate (the regime
 * chosen in the footer); a chosen rate is the line's own. Reverse charge is the whole document: no line rate then.
 * The rule that uses it: lib/invoice-totals (each line's VAT rounded, then added per rate).
 */
import React from 'react';

const RATES = [21, 12, 6, 0] as const;

interface Props {
    value: number | null | undefined;
    /** The document's regime ('21', '6', 'medecontractant', …). */
    vatRegime?: string;
    onChange: (rate: number | null) => void;
    readOnly?: boolean;
    className?: string;
}

export default function LineVatRateSelect({ value, vatRegime = '21', onChange, readOnly, className = '' }: Props) {
    if (vatRegime === 'medecontractant') return <span className={`text-sm text-neutral-400 ${className}`}>verlegd</span>;
    const own = typeof value === 'number' && Number.isFinite(value) ? value : null;
    return (
        <select
            aria-label="BTW-tarief van de lijn"
            disabled={readOnly}
            value={own === null ? '' : String(own)}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            className={`bg-transparent border-none text-sm text-right focus:outline-none focus:ring-0 cursor-pointer disabled:cursor-default ${own === null ? 'text-neutral-400' : 'text-black dark:text-white font-medium'} ${className}`}
        >
            <option value="">{vatRegime}% (doc)</option>
            {RATES.map(r => <option key={r} value={String(r)}>{r}%</option>)}
        </select>
    );
}
