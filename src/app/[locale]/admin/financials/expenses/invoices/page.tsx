"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

import { financialTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Expenses Database...</div> }
);

export default function ExpensesInvoicesPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Expense Invoices</h1>
                    <p className="text-sm text-neutral-500">Track and manage incoming invoices from suppliers and contractors.</p>
                </div>
                <DatabaseCloneDynamic databaseId="db-expenses" />
            </div>
        </div>
    );
}
