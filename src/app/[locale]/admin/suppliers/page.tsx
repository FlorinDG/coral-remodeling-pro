"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false }
);

export default function SuppliersPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Leveranciers (Suppliers)</h1>
                        <p className="text-neutral-500 font-medium text-sm mt-1">Manage your material providers, subcontractors, and core logistics partners.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-black border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-[600px] relative">
                    <DatabaseCloneDynamic databaseId="db-suppliers" />
                </div>
            </div>
        </div>
    );
}
