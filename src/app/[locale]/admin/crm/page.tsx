"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing CRM Environment...</div> }
);

import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function CRMPage() {
    usePageTitle('CRM Module');
    const [activeDb, setActiveDb] = useState<'db-crm' | 'db-bobex'>('db-crm');

    const headerTabs = (
        <div className="flex items-center gap-1">
            <button
                onClick={() => setActiveDb('db-crm')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeDb === 'db-crm'
                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
            >
                Main Pipeline
            </button>
            <button
                onClick={() => setActiveDb('db-bobex')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeDb === 'db-bobex'
                    ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
            >
                Bobex Pipeline
            </button>
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                {/* Sub-database Render */}
                <div className="flex-1 w-full min-h-0">
                    <DatabaseCloneDynamic key={activeDb} databaseId={activeDb} headerExtra={headerTabs} hideViewTabs />
                </div>
            </div>
        </div>
    );
}
