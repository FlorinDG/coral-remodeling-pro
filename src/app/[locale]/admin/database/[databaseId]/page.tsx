"use client";

import React, { use } from 'react';
import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="w-full h-[600px] bg-neutral-50 dark:bg-neutral-900/50 animate-pulse rounded-xl border border-neutral-200 dark:border-white/10" /> }
);

interface Props {
    params: Promise<{ locale: string; databaseId: string }>;
}

export default function GenericDatabasePage({ params }: Props) {
    // Unwrap the params promise using React.use
    const { databaseId } = use(params);

    return (
        <div className="w-full h-full pb-20">
            <div className="h-[calc(100vh-8rem)] w-full">
                <DatabaseCloneDynamic databaseId={databaseId} />
            </div>
        </div>
    );
}
