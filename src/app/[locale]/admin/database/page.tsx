"use client";

import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Database Environment...</div> }
);

export default function DatabasePage() {
    return (
        <div className="w-full h-full pb-10">
            <DatabaseCloneDynamic />
        </div>
    );
}
