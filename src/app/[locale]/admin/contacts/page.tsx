"use client";

import dynamic from 'next/dynamic';
import { usePageTitle } from '@/hooks/usePageTitle';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";
import Link from 'next/link';
import { Settings } from 'lucide-react';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Contacts Database...</div> }
);

export default function ContactsPage() {
    usePageTitle('Contacts');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full flex flex-col pt-6 pb-6 px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 relative">
                    <DatabaseCloneDynamic databaseId="db-clients" />
                </div>
            </div>
        </div>
    );
}
