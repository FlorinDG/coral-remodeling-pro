"use client";

import dynamic from 'next/dynamic';
import CreateQuotationButton from "@/components/admin/quotations/CreateQuotationButton";
import { usePageTitle } from '@/hooks/usePageTitle';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Quotations Database...</div> }
);

export default function QuotationsPage() {
    usePageTitle('Quotations');

    return (
        <div className="flex flex-col w-full h-full">
            {/* Page Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex-shrink-0">
                <h1 className="text-xl font-bold tracking-tight">Quotations (Offertes)</h1>
                <CreateQuotationButton />
            </div>

            {/* Grid — footer New hidden, row click already navigates to engine */}
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-quotations" hideFooterNew />
            </div>
        </div>
    );
}
