"use client";

import dynamic from 'next/dynamic';
import { usePageTitle } from '@/hooks/usePageTitle';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Tasks Database...</div> }
);


export default function TasksPage() {
    usePageTitle('Tasks');

    return (
        <div className="flex flex-col w-full h-full">
            <div className="w-full h-full p-6 pb-10">
                <DatabaseCloneDynamic databaseId="db-tasks" />
            </div>
        </div>
    );
}
