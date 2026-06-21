"use client";

import dynamic from 'next/dynamic';
import CreateQuotationButton from "@/components/admin/quotations/CreateQuotationButton";
import { usePageTitle } from '@/hooks/usePageTitle';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { quotationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Quotations Database...</div> }
);

export default function QuotationsPage() {
    usePageTitle('Quotations');

    return (
        <div className="flex flex-col w-full h-full">
            <div className="relative">
                <ModuleTabs tabs={quotationsTabs} groupId="quotations" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20">
                    <CreateQuotationButton />
                </div>
            </div>

            {/* Grid — footer New hidden, row click already navigates to engine */}
            <div className="w-full flex-1 flex flex-col pt-6 pb-6 px-3 md:px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 relative">
                    <DatabaseCloneDynamic databaseId="db-quotations" hideFooterNew />
                </div>
            </div>
        </div>
    );
}
