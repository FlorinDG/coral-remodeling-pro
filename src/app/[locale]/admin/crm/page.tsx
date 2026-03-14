"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing CRM Environment...</div> }
);

export default function CRMPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">CRM Module</h1>
                    <p className="text-sm text-neutral-500">Manage customer relationships, leads, and sales pipelines.</p>
                </div>
                {/* Reusing the DatabaseClone skeleton for the CRM view */}
                <DatabaseCloneDynamic databaseId="db-crm" />
            </div>
        </div>
    );
}
