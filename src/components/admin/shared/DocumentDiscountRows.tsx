"use client";
/**
 * DOC-LINES-1 · the discount rows of a quote / invoice / proforma / credit note's totals: the line discounts together,
 * and the discount on the total (a percentage or a fixed amount, before VAT). Figures from lib/invoice-totals.
 */
import React from 'react';
import ClientDiscountInput from './ClientDiscountInput';
import { documentDiscountPercent, type InvoiceTotals } from '@/lib/invoice-totals';
import { formatPercent } from '@/lib/format/number';
import type { Discount } from '@/lib/records/document-lines';

interface Props {
    totals: InvoiceTotals;
    value: Discount | null;
    onChange?: (d: Discount | null) => void;
    readOnly?: boolean;
    formatCurrency: (n: number) => string;
}

export default function DocumentDiscountRows({ totals, value, onChange, readOnly, formatCurrency }: Props) {
    const editable = !!onChange && !readOnly;
    const pct = documentDiscountPercent(totals, value);
    if (!editable && totals.lineDiscounts <= 0 && totals.documentDiscount <= 0) return null;
    return (
        <div className="flex flex-col">
            {totals.lineDiscounts > 0 && (
                <div className="flex items-center justify-between px-5 py-2 border-b border-neutral-100 dark:border-white/5">
                    <span className="text-[13px] text-neutral-500 dark:text-neutral-400">Korting op regels</span>
                    <span className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">− {formatCurrency(totals.lineDiscounts)}</span>
                </div>
            )}
            <div className="flex items-center justify-between gap-3 px-5 py-2 border-b border-neutral-100 dark:border-white/5">
                <span className="text-[13px] text-neutral-500 dark:text-neutral-400 shrink-0">Korting op totaal{pct !== null ? ` — ${formatPercent(pct)}` : ''}</span>
                <div className="flex items-center gap-3">
                    {editable && (
                        <ClientDiscountInput className="w-32 border border-neutral-200 dark:border-white/10 rounded-md px-1.5" value={value} onChange={d => onChange!(d)} />
                    )}
                    <span className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums min-w-[90px] text-right">
                        {totals.documentDiscount > 0 ? `− ${formatCurrency(totals.documentDiscount)}` : '—'}
                    </span>
                </div>
            </div>
        </div>
    );
}
