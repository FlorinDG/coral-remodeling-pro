"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Clients Database...</div> }
);

import { usePageTitle } from '@/hooks/usePageTitle';

export default function ClientsPage() {
    usePageTitle('Clients Directory');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full p-6 pb-10">
                {/* Reusing the DatabaseClone skeleton for the Clients view */}
                <DatabaseCloneDynamic databaseId="db-clients" />
            </div>
        </div>
    );
}
