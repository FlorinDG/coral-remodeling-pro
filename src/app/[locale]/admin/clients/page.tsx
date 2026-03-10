"use client";

import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Clients Database...</div> }
);

export default function ClientsPage() {
    return (
        <div className="w-full h-full pb-10">
            <div className="mb-4">
                <h1 className="text-2xl font-bold">Clients Directory</h1>
                <p className="text-sm text-neutral-500">Manage all client contact information and active status.</p>
            </div>
            {/* Intentionally reusing the DatabaseClone as the foundational skeleton */}
            <DatabaseCloneDynamic />
        </div>
    );
}
