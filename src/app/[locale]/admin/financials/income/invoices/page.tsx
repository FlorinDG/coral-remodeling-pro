"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { financialTabs } from "@/config/tabs";
import CreateInvoiceButton from "@/components/admin/invoices/CreateInvoiceButton";

import { usePageTitle } from '@/hooks/usePageTitle';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Invoices Database...</div> }
);

export default function SalesInvoicesPage() {
    usePageTitle('Sales Invoices');

    return (
        <div className="flex flex-col w-full h-full">
            <div className="relative">
                <ModuleTabs tabs={financialTabs} groupId="financials" />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20">
                    <CreateInvoiceButton />
                </div>
            </div>
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-invoices" />
            </div>
        </div>
    );
}
