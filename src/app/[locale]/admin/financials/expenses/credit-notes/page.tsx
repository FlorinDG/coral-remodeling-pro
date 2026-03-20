"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";
import PageTitle from "@/components/admin/PageTitle";
import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Expenses Database...</div> }
);

export default function ExpensesCreditNotesPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <PageTitle title="Expense Credit Notes" />
            <ModuleTabs tabs={financialTabs} groupId="financials" />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-expenses" />
            </div>
        </div>
    );
}
