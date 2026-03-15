"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Invoices Database...</div> }
);

import { usePageTitle } from '@/hooks/usePageTitle';

export default function IncomeInvoicesPage() {
    usePageTitle('Income Invoices');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full p-6 pb-10">
                <DatabaseCloneDynamic databaseId="db-invoices" />
            </div>
        </div>
    );
}
