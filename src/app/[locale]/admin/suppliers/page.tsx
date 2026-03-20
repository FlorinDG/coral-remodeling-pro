"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";
import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Database...</div> }
);

export default function SuppliersPage() {
    usePageTitle('Supplier Directory');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-suppliers" />
            </div>
        </div>
    );
}
