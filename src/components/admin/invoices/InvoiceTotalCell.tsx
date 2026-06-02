"use client";

import { useDatabaseStore } from '@/components/admin/database/store';
import { Euro } from 'lucide-react';
import { useMemo } from 'react';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';

interface InvoiceTotalCellProps {
    invoiceId: string;
    fallbackTotal: number;
    fallbackVat: number;
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
        const vatCalcMode = ((invoice.properties?.['vatCalcMode'] as string) || 'lines') as 'lines' | 'total';
        const vatRegime = (invoice.properties?.['vatRegime'] as string) || '21';
        const totals = calculateInvoiceTotals(invoice.blocks, { vatCalcMode, vatRegime });
        return { totalInclVAT: totals.totalInclVAT, totalVAT: totals.totalVAT };
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
