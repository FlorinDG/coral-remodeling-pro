"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Outgoing Payments Database...</div> }
);

export default function OutgoingPaymentsPage() {
    usePageTitle('Outgoing Payments');
    const { planType } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            <div className="relative">
                <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            </div>
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-payments-out" />
            </div>
        </div>
    );
}
