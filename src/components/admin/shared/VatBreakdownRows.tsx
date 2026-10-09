"use client";
/**
 * DOC-LINES-2 · the VAT per rate of a document with mixed rates (Florin 2026-10-09: "yes"), under the regime select.
 * Figures from lib/invoice-totals — each line's VAT rounded, then added per rate. One rate: nothing to show (the regime
 * row carries the total).
 */
import React from 'react';
import type { VatBreakdownItem } from '@/lib/invoice-totals';

export default function VatBreakdownRows({ breakdown, formatCurrency }: { breakdown: VatBreakdownItem[]; formatCurrency: (n: number) => string }) {
    if (breakdown.length < 2) return null;
    return (
        <div className="flex flex-col pb-1">
            {breakdown.map(({ rate, base, vat }) => (
                <div key={rate} className="flex items-center justify-between px-5 py-1 gap-3">
                    <span className="text-[12px] text-neutral-500 dark:text-neutral-400 tabular-nums">BTW {rate}% op {formatCurrency(base)}</span>
                    <span className="text-[12px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">{formatCurrency(vat)}</span>
                </div>
            ))}
        </div>
    );
}
