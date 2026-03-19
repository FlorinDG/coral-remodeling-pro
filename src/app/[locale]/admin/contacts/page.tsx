"use client";

import dynamic from 'next/dynamic';
import { usePageTitle } from '@/hooks/usePageTitle';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Contacts Database...</div> }
);

export default function ContactsPage() {
    usePageTitle('Contacts');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full p-6 pb-10">
                <DatabaseCloneDynamic databaseId="db-clients" />
            </div>
        </div>
    );
}
