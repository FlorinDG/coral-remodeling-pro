"use client";

import { useDatabaseStore } from '@/components/admin/database/store';
import { Block } from '@/components/admin/database/types';
import { Euro } from 'lucide-react';
import { useMemo } from 'react';

interface InvoiceTotalCellProps {
    invoiceId: string;
    fallbackTotal: number;
    fallbackVat: number;
}

function calculateFromBlocks(blocks: Block[], vatCalcMode: string, vatRegime: string): { subtotal: number; totalVAT: number; totalInclVAT: number } {
    let subtotal = 0;
    const vatMap = new Map<number, number>();

    const accumulate = (nodes: Block[]) => {
        nodes.forEach(b => {
            if (b.isOptional) return;
            if (b.type === 'section' || b.type === 'subsection' || b.type === 'post') {
                accumulate(b.children || []);
            } else if (b.type === 'line' || b.type === 'article' || b.type === 'bestek') {
                const qty = b.quantity || 1;
                const price = b.unitPrice || b.verkoopPrice || 0;
                const lineTotal = price * qty;
                subtotal += lineTotal;

                let effectiveRate: number;
                if (vatCalcMode === 'lines') {
                    effectiveRate = b.vatMedecontractant ? 0 : (b.vatRate ?? 21);
                } else {
                    effectiveRate = vatRegime === 'medecontractant' ? 0 : parseFloat(vatRegime || '21');
                }

                vatMap.set(effectiveRate, (vatMap.get(effectiveRate) || 0) + lineTotal * (effectiveRate / 100));
            }
        });
    };

    accumulate(blocks);

    const totalVAT = Array.from(vatMap.values()).reduce((sum, v) => sum + v, 0);
    return { subtotal, totalVAT, totalInclVAT: subtotal + totalVAT };
}

export default function InvoiceTotalCell({ invoiceId, fallbackTotal, fallbackVat }: InvoiceTotalCellProps) {
    const invoice = useDatabaseStore(state => {
        const db = state.databases.find(d => d.id === 'db-invoices' || d.id.startsWith('db-invoices-'));
        return db?.pages.find(p => p.id === invoiceId) || null;
    });

    const { totalInclVAT, totalVAT } = useMemo(() => {
        if (!invoice || !invoice.blocks || invoice.blocks.length === 0) {
            return { totalInclVAT: fallbackTotal, totalVAT: fallbackVat };
        }
        const vatCalcMode = (invoice.properties?.['vatCalcMode'] as string) || 'lines';
        const vatRegime = (invoice.properties?.['vatRegime'] as string) || '21';
        return calculateFromBlocks(invoice.blocks, vatCalcMode, vatRegime);
    }, [invoice, fallbackTotal, fallbackVat]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-BE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(val);
    };

    return (
        <div>
            <div className="flex items-center gap-1 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                <Euro className="w-3 h-3 text-neutral-400" />
                {formatCurrency(totalInclVAT)}
            </div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5">
                {formatCurrency(totalVAT)} VAT
            </div>
        </div>
    );
}
