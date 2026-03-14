"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

export const financialTabs = [
    { label: 'Aankoopfacturen', href: '/admin/financials/expenses/invoices', id: 'fin-aankoop' },
    { label: 'Creditnota - aankoop', href: '/admin/financials/expenses/credit-notes', id: 'fin-cred-aankoop' },
    { label: 'Creditnota - verkoop', href: '/admin/financials/income/credit-notes', id: 'fin-cred-verkoop' },
    { label: 'FACTUREN', href: '/admin/financials/income/invoices', id: 'fin-facturen' },
    { label: 'offertes', href: '/admin/quotations', id: 'fin-offertes' },
];

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Expenses Database...</div> }
);

export default function ExpensesInvoicesPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={financialTabs} />
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
