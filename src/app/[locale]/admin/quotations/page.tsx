"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import CreateQuotationButton from "@/components/admin/quotations/CreateQuotationButton";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTenant } from '@/context/TenantContext';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Quotations Database...</div> }
);

export default function QuotationsPage() {
    usePageTitle('Quotations');

    const { planType } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            {/* Tabs + New Quotation button */}
            <div className="relative">
                <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20">
                    <CreateQuotationButton />
                </div>
            </div>

            {/* Grid — footer New hidden, row click already navigates to engine */}
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-quotations" hideFooterNew />
            </div>
        </div>
    );
}
