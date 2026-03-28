"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDatabaseStore } from '@/components/admin/database/store';

// Dynamically import the Database View Manager
const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-xl border border-neutral-200 dark:border-white/10" /> }
);

export default function DynamicDatabasePage() {
    const { databases, createDatabase } = useDatabaseStore();

    return (
        <div className="w-full h-full pb-20 pt-6">
            <div className="mb-6 px-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Workspace Databases</h1>
                    <p className="text-neutral-500 dark:text-neutral-400">Custom dynamic tables.</p>
                </div>
                <button
                    onClick={() => createDatabase('New Database', 'A newly instantiated schema.')}
                    className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black font-semibold rounded-lg hover:opacity-90"
                >
                    + Add Database
                </button>
            </div>

            {/* Render the first DB (our mock) */}
            <div className="h-[calc(100vh-14rem)] w-full">
                {databases.length > 0 ? (
                    <DatabaseCloneDynamic databaseId={databases[0].id} />
                ) : (
                    <p>No databases found.</p>
                )}
            </div>
        </div>
    );
}
