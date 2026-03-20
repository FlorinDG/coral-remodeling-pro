"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

import { hrTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing HR Database...</div> }
);

import { usePageTitle } from '@/hooks/usePageTitle';

export default function EmployeeDirectoryPage() {
    usePageTitle('Employee Directory');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} groupId="hr" />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-hr" />
            </div>
        </div>
    );
}
