"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing CRM Environment...</div> }
);

import { useState } from 'react';

export default function CRMPage() {
    const [activeDb, setActiveDb] = useState<'db-crm' | 'db-bobex'>('db-crm');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} />
            <div className="w-full h-full p-6 pb-10 flex flex-col">
                <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-white/10 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold">CRM Module</h1>
                        <p className="text-sm text-neutral-500">Manage customer relationships, leads, and sales pipelines.</p>
                    </div>

                    {/* Pipeline Toggle */}
                    <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveDb('db-crm')}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeDb === 'db-crm' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm border border-neutral-200 dark:border-white/10' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white border border-transparent'}`}
                        >
                            Main Pipeline
                        </button>
                        <button
                            onClick={() => setActiveDb('db-bobex')}
                            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeDb === 'db-bobex' ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm border border-neutral-200 dark:border-white/10' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white border border-transparent'}`}
                        >
                            Bobex Pipeline
                        </button>
                    </div>
                </div>

                {/* Sub-database Render */}
                <div className="flex-1 w-full min-h-0">
                    {activeDb === 'db-crm' ? (
                        <DatabaseCloneDynamic databaseId="db-crm" />
                    ) : (
                        <DatabaseCloneDynamic databaseId="db-bobex" />
                    )}
                </div>
            </div>
        </div>
    );
}
