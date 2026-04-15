"use client";

import React, { useMemo } from 'react';
import { Block } from '@/components/admin/database/types';

interface QuotationFooterReportProps {
    blocks: Block[];
    quotationTitle?: string;
    expiryDate?: string;
    vatCalcMode: 'lines' | 'total';
    vatRegime: string;
    onVatCalcModeChange: (mode: 'lines' | 'total') => void;
    onVatRegimeChange: (regime: string) => void;
}

type VatRegime = '21' | '12' | '6' | '0' | 'medecontractant';

const MEDECONTRACTANT_LEGAL_TEXT = `Btw verlegd — Verlegging van heffing. De btw is verschuldigd door de medecontractant overeenkomstig artikel 20 van het koninklijk besluit nr. 1 van 29 december 1992. De afnemer is gehouden de verschuldigde belasting te voldoen.`;

export default function QuotationFooterReport({
    blocks,
    quotationTitle,
    expiryDate,
    vatCalcMode,
    vatRegime: vatRegimeProp,
    onVatCalcModeChange,
    onVatRegimeChange,
}: QuotationFooterReportProps) {
    const vatRegime = vatRegimeProp as VatRegime;

    // ── Financial VAT Calculation ──
    const { subtotal, vatBreakdown, lineCount, hasLineMedecontractant } = useMemo(() => {
        let subtotal = 0;
        let lineCount = 0;
        let hasLineMedecontractant = false;
        const vatMap = new Map<number, { base: number; vat: number }>();

        const accumulate = (nodes: Block[]) => {
            nodes.forEach(b => {
                if (b.isOptional) return;
                if (b.type === 'section' || b.type === 'subsection' || b.type === 'post') {
                    accumulate(b.children || []);
                } else if (b.type === 'line' || b.type === 'article' || b.type === 'bestek') {
                    const qty = b.quantity || 1;
                    const price = b.verkoopPrice || 0;
                    const lineTotal = price * qty;
                    subtotal += lineTotal;
                    lineCount++;

                    const lineVatRate = b.vatRate ?? 21;

                    if (b.vatMedecontractant) {
                        hasLineMedecontractant = true;
                    }

                    let effectiveRate: number;
                    if (vatCalcMode === 'lines') {
                        effectiveRate = b.vatMedecontractant ? 0 : lineVatRate;
                    } else {
                        effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime);
                    }

                    const existing = vatMap.get(effectiveRate) || { base: 0, vat: 0 };
                    existing.base += lineTotal;
                    existing.vat += lineTotal * (effectiveRate / 100);
                    vatMap.set(effectiveRate, existing);
                }
            });
        };

        accumulate(blocks);

        const vatBreakdown = Array.from(vatMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([rate, data]) => ({ rate, ...data }));

        return { subtotal, vatBreakdown, lineCount, hasLineMedecontractant };
    }, [blocks, vatCalcMode, vatRegime]);

    // ── Profitability Calculation ──
    const { grandKost, grandVerkoop } = useMemo(() => {
        let grandKost = 0;
        let grandVerkoop = 0;
        const accumulate = (nodes: Block[]) => {
            nodes.forEach(b => {
                if (b.isOptional) return;
                if (b.type === 'section' || b.type === 'subsection' || b.type === 'post') {
                    accumulate(b.children || []);
                } else if (b.type === 'article' || b.type === 'bestek' || b.type === 'line') {
                    const qty = b.quantity || 1;
                    grandKost += (b.brutoPrice || 0) * (1 - (b.discountPercent || 0) / 100) * qty;
                    grandVerkoop += (b.verkoopPrice || 0) * qty;
                }
            });
        };
        accumulate(blocks);
        return { grandKost, grandVerkoop };
    }, [blocks]);

    const totalVAT = vatBreakdown.reduce((sum, v) => sum + v.vat, 0);
    const totalInclVAT = subtotal + totalVAT;
    const showMedecontractant = vatRegime === 'medecontractant' || (vatCalcMode === 'lines' && hasLineMedecontractant);
    const grandProfit = grandVerkoop - grandKost;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-BE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
        }).format(val);
    };

    const isLinesMode = vatCalcMode === 'lines';

    return (
        <div className="w-full mt-10 pt-6 border-t border-dashed border-neutral-300 dark:border-neutral-700">

            {/* Medecontractant Legal Notice */}
            {showMedecontractant && (
                <div
                    className="mb-6 p-4 rounded-lg border-l-4 text-[15px] leading-relaxed"
                    style={{
                        borderColor: 'var(--brand-color, #d35400)',
                        backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 4%, white)',
                        color: 'color-mix(in srgb, var(--brand-color, #d35400) 80%, black)',
                    }}
                >
                    <p className="italic text-neutral-700 dark:text-neutral-300">
                        {MEDECONTRACTANT_LEGAL_TEXT}
                    </p>
                </div>
            )}

            {/* Unified Footer Grid — 3 columns */}
            <div className="grid grid-cols-[1fr_auto_1.4fr] gap-0 rounded-xl overflow-hidden border shadow-sm"
                style={{ borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 20%, transparent)' }}
            >

                {/* Column 1: Offerte Info */}
                <div className="bg-neutral-50/80 dark:bg-white/[0.02] p-5 border-r border-neutral-200/60 dark:border-white/5">
                    <h4
                        className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3"
                        style={{ color: 'var(--brand-color, #d35400)' }}
                    >
                        Offerteoverzicht
                    </h4>

                    <div className="space-y-1.5 text-[13px]">
                        {quotationTitle && (
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-neutral-400 dark:text-neutral-500">Nummer</span>
                                <span className="font-bold text-neutral-800 dark:text-neutral-200 font-mono text-xs tracking-wide">{quotationTitle}</span>
                            </div>
                        )}
                        {expiryDate && (
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-neutral-400 dark:text-neutral-500">Vervaldatum</span>
                                <span className="font-medium text-neutral-700 dark:text-neutral-300">{expiryDate}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-neutral-400 dark:text-neutral-500">Regels</span>
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">{lineCount}</span>
                        </div>
                    </div>
                </div>

                {/* Column 2: BTW Calculation Mode */}
                <div className="bg-neutral-50/80 dark:bg-white/[0.02] p-5 border-r border-neutral-200/60 dark:border-white/5 min-w-[180px]">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3 text-neutral-400 dark:text-neutral-500">
                        BTW Berekening
                    </h4>

                    <div className="flex flex-col gap-1.5">
                        <label
                            className={`flex items-center gap-2 cursor-pointer rounded-md px-2.5 py-2 transition-all text-[13px] ${
                                isLinesMode
                                    ? 'bg-white dark:bg-white/5 shadow-sm border'
                                    : 'border border-transparent hover:bg-white/60 dark:hover:bg-white/[0.03]'
                            }`}
                            style={isLinesMode ? { borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 30%, transparent)' } : {}}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                isLinesMode ? '' : 'border-neutral-300 dark:border-neutral-600'
                            }`}
                                style={isLinesMode ? { borderColor: 'var(--brand-color, #d35400)' } : {}}
                            >
                                {isLinesMode && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--brand-color, #d35400)' }} />}
                            </div>
                            <div className="flex flex-col leading-tight">
                                <span className={`font-semibold transition-colors ${isLinesMode ? '' : 'text-neutral-500 dark:text-neutral-400'}`}
                                    style={isLinesMode ? { color: 'var(--brand-color, #d35400)' } : {}}
                                >
                                    Som per lijn
                                </span>
                            </div>
                            <input type="radio" name="vatCalcModeQ" value="lines" checked={isLinesMode} onChange={() => onVatCalcModeChange('lines')} className="sr-only" />
                        </label>

                        <label
                            className={`flex items-center gap-2 cursor-pointer rounded-md px-2.5 py-2 transition-all text-[13px] ${
                                !isLinesMode
                                    ? 'bg-white dark:bg-white/5 shadow-sm border'
                                    : 'border border-transparent hover:bg-white/60 dark:hover:bg-white/[0.03]'
                            }`}
                            style={!isLinesMode ? { borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 30%, transparent)' } : {}}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                !isLinesMode ? '' : 'border-neutral-300 dark:border-neutral-600'
                            }`}
                                style={!isLinesMode ? { borderColor: 'var(--brand-color, #d35400)' } : {}}
                            >
                                {!isLinesMode && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--brand-color, #d35400)' }} />}
                            </div>
                            <div className="flex flex-col leading-tight">
                                <span className={`font-semibold transition-colors ${!isLinesMode ? '' : 'text-neutral-500 dark:text-neutral-400'}`}
                                    style={!isLinesMode ? { color: 'var(--brand-color, #d35400)' } : {}}
                                >
                                    % op totaal
                                </span>
                            </div>
                            <input type="radio" name="vatCalcModeQ" value="total" checked={!isLinesMode} onChange={() => onVatCalcModeChange('total')} className="sr-only" />
                        </label>
                    </div>
                </div>

                {/* Column 3: Totals */}
                <div className="flex flex-col">
                    {/* Subtotal */}
                    <div className="flex items-center justify-between px-5 py-3 bg-neutral-50/80 dark:bg-white/[0.02]">
                        <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Subtotaal excl. BTW</span>
                        <span className="text-[15px] font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatCurrency(subtotal)}</span>
                    </div>

                    {/* BTW rows */}
                    {isLinesMode ? (
                        <>
                            {vatBreakdown.map(({ rate, base, vat }) => (
                                <div key={rate} className="flex items-center justify-between px-5 py-2 border-t border-neutral-100 dark:border-white/5 gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest shrink-0">BTW</span>
                                        <span className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">
                                            {rate === 0 ? (hasLineMedecontractant ? 'Verlegd' : '0%') : `${rate}%`}
                                        </span>
                                        <span className="text-[11px] text-neutral-400 tabular-nums">
                                            (op {formatCurrency(base)})
                                        </span>
                                    </div>
                                    <span className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums shrink-0">{formatCurrency(vat)}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div className="flex items-center justify-between px-5 py-2.5 border-t border-neutral-100 dark:border-white/5 gap-3">
                            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest shrink-0">BTW Regime</span>
                            <select
                                value={vatRegime}
                                onChange={(e) => onVatRegimeChange(e.target.value)}
                                className="text-[13px] font-semibold bg-white dark:bg-neutral-900 border rounded-md px-2 py-1 focus:outline-none cursor-pointer appearance-auto"
                                style={{
                                    borderColor: 'color-mix(in srgb, var(--brand-color, #d35400) 30%, transparent)',
                                    color: 'var(--brand-color, #d35400)',
                                }}
                            >
                                <option value="21">21% — Standaard</option>
                                <option value="12">12% — Sociaal woning</option>
                                <option value="6">6% — Renovatie (&gt;10j)</option>
                                <option value="0">0% — Vrijgesteld</option>
                                <option value="medecontractant">Medecontractant (verlegde BTW)</option>
                            </select>
                            <span className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums shrink-0">{formatCurrency(totalVAT)}</span>
                        </div>
                    )}

                    {/* Grand Total */}
                    <div
                        className="flex items-center justify-between px-5 py-3.5 border-t-2 mt-auto"
                        style={{
                            borderColor: 'var(--brand-color, #d35400)',
                            backgroundColor: 'color-mix(in srgb, var(--brand-color, #d35400) 6%, white)',
                        }}
                    >
                        <span
                            className="text-[13px] font-bold uppercase tracking-wide"
                            style={{ color: 'var(--brand-color, #d35400)' }}
                        >
                            Totaal incl. BTW
                        </span>
                        <span
                            className="text-xl font-extrabold tabular-nums"
                            style={{ color: 'var(--brand-color, #d35400)' }}
                        >
                            {formatCurrency(totalInclVAT)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Profitability Executive Summary — Admin-only metrics */}
            <div className="mt-8 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Project Profitability Estimate</h3>
                <div className="w-full md:w-1/2 ml-auto overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111] shadow-sm">
                    <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                            <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-black dark:text-white">
                                <td className="px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400">Total Cost</td>
                                <td className="px-4 py-3 text-right font-bold opacity-70">{formatCurrency(grandKost)}</td>
                            </tr>
                            <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-black dark:text-white bg-blue-50/30 dark:bg-blue-900/10">
                                <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">Total Verkoop</td>
                                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 text-lg">{formatCurrency(grandVerkoop)}</td>
                            </tr>
                            <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-black dark:text-white bg-emerald-50/30 dark:bg-emerald-900/10">
                                <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-500">Est. Profit</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-500 text-lg">{formatCurrency(grandProfit)}</td>
                            </tr>
                            <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-black dark:text-white">
                                <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-500">Margin %</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-500">{grandKost > 0 ? `${((grandProfit / grandKost) * 100).toFixed(2)}%` : '0.00%'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
