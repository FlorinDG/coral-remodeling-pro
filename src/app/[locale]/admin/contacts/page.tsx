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
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden relative isolate">
                    <DatabaseCloneDynamic
                        databaseId="db-clients"
                        headerExtra={
                            <Link href="/admin/settings/databases/db-clients" className="flex items-center gap-1.5 text-neutral-500 hover:text-[#d35400] px-3 py-1 mx-2 bg-neutral-100 dark:bg-white/5 hover:bg-[#d35400]/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                                <Settings className="w-3 h-3" /> Edit Schema Fields
                            </Link>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
