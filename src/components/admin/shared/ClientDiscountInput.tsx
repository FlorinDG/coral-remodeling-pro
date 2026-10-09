"use client";
/**
 * DOC-LINES-1 · the customer discount field — a percentage or a fixed amount (Florin 2026-10-09: "both percentage and
 * fixed amount"). One field for the line and for the total of every quote, invoice, proforma and credit note. The
 * value is lib/records/document-lines' Discount; empty = no discount.
 */
import React from 'react';
import DecimalInput from '@/components/ui/DecimalInput';
import { discountOf, type Discount, type DiscountKind } from '@/lib/records/document-lines';

interface Props {
    value: Discount | null | undefined;
    onChange: (d: Discount | null) => void;
    readOnly?: boolean;
    className?: string;
}

export default function ClientDiscountInput({ value, onChange, readOnly, className = '' }: Props) {
    const d = discountOf(value);
    const kind: DiscountKind = (value && (value as Discount).kind) || 'pct';
    const setKind = (k: DiscountKind) => { if (!readOnly) onChange(d ? { kind: k, value: d.value } : { kind: k, value: 0 }); };
    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <DecimalInput
                value={d?.value ?? null}
                onValueChange={n => onChange(n && n > 0 ? { kind, value: n } : null)}
                readOnly={readOnly}
                placeholder="0"
                aria-label="Korting"
                className="w-full min-w-0 bg-transparent border-none text-right text-base text-black dark:text-white focus:outline-none focus:ring-0 placeholder:text-neutral-300 py-0.5"
            />
            <div role="group" aria-label="Soort korting" className="flex shrink-0 rounded-md border border-neutral-200 dark:border-white/10 overflow-hidden text-[11px] font-bold">
                {(['pct', 'amount'] as const).map(k => (
                    <button key={k} type="button" disabled={readOnly} onClick={() => setKind(k)}
                            className={`px-1.5 py-0.5 ${kind === k ? 'bg-neutral-800 text-white dark:bg-white dark:text-black' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10'}`}>
                        {k === 'pct' ? '%' : '€'}
                    </button>
                ))}
            </div>
        </div>
    );
}
