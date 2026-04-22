"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { useTenant } from '@/context/TenantContext';
import PageTitle from "@/components/admin/PageTitle";
import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Credit Notes Database...</div> }
);

export default function IncomeCreditNotesPage() {
    const { planType } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Sales Credit Notes" />
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />

            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-invoices" defaultFilter={{ propertyId: 'docType', value: 'opt-credit-note' }} />
            </div>
        </div>
    );
}
