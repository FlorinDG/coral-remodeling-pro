"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "../financials/expenses/invoices/page";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Quotations Database...</div> }
);

export default function QuotationsPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Quotations</h1>
                    <p className="text-sm text-neutral-500">Generate, send, and track project quotations and estimates.</p>
                </div>
                <DatabaseCloneDynamic databaseId="db-quotations" />
            </div>
        </div>
    );
}
