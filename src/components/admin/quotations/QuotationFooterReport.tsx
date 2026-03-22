import React, { useMemo } from 'react';
import { Block } from '@/components/admin/database/types';

interface QuotationFooterReportProps {
    blocks: Block[];
}

type CalcCategory = 'levering' | 'materieel' | 'loon' | 'indirect';

interface Totals {
    kost: number;
    verkoop: number;
}

export default function QuotationFooterReport({ blocks }: QuotationFooterReportProps) {

    const { report, grandKost, grandVerkoop } = useMemo(() => {
        const categories: Record<CalcCategory, Totals> = {
            levering: { kost: 0, verkoop: 0 },
            materieel: { kost: 0, verkoop: 0 },
            loon: { kost: 0, verkoop: 0 },
            indirect: { kost: 0, verkoop: 0 }
        };

        const accumulate = (nodes: Block[]) => {
            nodes.forEach(b => {
                if (b.isOptional) return; // Entirely ignore optional items in Profit reporting

                if (b.type === 'section' || b.type === 'subsection' || b.type === 'post') {
                    accumulate(b.children || []);
                } else if (b.type === 'article' || b.type === 'bestek' || b.type === 'line') {
                    // Legacy backwards-compatibility mapper
                    let ct = (b.calculationType as string) || 'loon'; // Cast to string to allow 'work', 'material' etc.
                    if (ct === 'work' || ct === 'subcontractor') ct = 'loon';
                    if (ct === 'material' || ct === 'tool') ct = 'materieel';
                    if (ct === 'transport' || ct === 'indirect_costs') ct = 'indirect';

                    const cat = (categories as any)[ct]; // Use 'any' for temporary access with string key
                    if (cat) {
                        const qty = b.quantity || 1;
                        cat.kost += (b.brutoPrice || 0) * (1 - (b.discountPercent || 0) / 100) * qty;
                        cat.verkoop += (b.verkoopPrice || 0) * qty;
                    }
                }
            });
        };

        accumulate(blocks);

        let grandKost = 0;
        let grandVerkoop = 0;

        Object.values(categories).forEach(cat => {
            grandKost += cat.kost;
            grandVerkoop += cat.verkoop;
        });

        return { report: categories, grandKost, grandVerkoop };
    }, [blocks]);

    const grandProfit = grandVerkoop - grandKost;
    const grandMargin = grandVerkoop > 0 ? (grandProfit / grandKost) * 100 : 0; // Marge percentage is based on markup over cost or margin over revenue? Usually markup: (Verkoop - Kost)/Kost. Or margin: (Verkoop - Kost)/Verkoop. Let's stick with (Profit/Cost) markup as standard in BE construction or Profit/Verkoop. Let's do markup over cost for Marge%.

    const formatCurrency = (val: number) => `€${val.toFixed(2)}`;
    const formatPercent = (profit: number, cost: number) => {
        if (cost === 0) return '0.00%';
        return `${((profit / cost) * 100).toFixed(2)}%`;
    };

    const categoryLabels: Record<CalcCategory, string> = {
        levering: 'Levering',
        materieel: 'Materieel',
        loon: 'Loon/OA',
        indirect: 'Indirecte Kosten'
    };

    return (
        <div className="w-full flex flex-col gap-12 mt-16 pt-8 border-t-2 border-dashed border-neutral-300 dark:border-neutral-800">

            {/* Profitability Executive Summary (Visible to Admin/Management usually, but put here as requested) */}
            <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-black dark:text-white uppercase tracking-wider">Project Profitability Estimate</h3>

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
                                <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-500">{formatPercent(grandProfit, grandKost)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Signature Block Form */}
            <div className="w-full flex flex-col md:flex-row gap-8 justify-between mt-8">
                {/* Coral Representation */}
                <div className="flex-1 flex flex-col gap-12 p-6 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">Voor Akkoord (Coral)</span>
                        <span className="text-base font-medium">Coral Remodeling Pro</span>
                    </div>
                    <div className="border-b-2 border-black dark:border-white opacity-20 w-full" />
                    <div className="flex justify-between text-xs text-neutral-500">
                        <span>Handtekening</span>
                        <span>Datum</span>
                    </div>
                </div>

                {/* Client Signature */}
                <div className="flex-1 flex flex-col gap-12 p-6 rounded-lg bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">Voor Akkoord (Klant)</span>
                        <span className="text-base font-medium placeholder-text">.............................................</span>
                    </div>
                    <div className="border-b-2 border-black dark:border-white opacity-20 w-full" />
                    <div className="flex justify-between text-xs text-neutral-500">
                        <span>Handtekening</span>
                        <span>Datum</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
