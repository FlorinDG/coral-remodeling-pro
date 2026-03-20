"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

import { financialTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Expenses Database...</div> }
);

import { usePageTitle } from '@/hooks/usePageTitle';

export default function ExpensesInvoicesPage() {
    usePageTitle('Expense Invoices');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-expenses" />
            </div>
        </div>
    );
}
