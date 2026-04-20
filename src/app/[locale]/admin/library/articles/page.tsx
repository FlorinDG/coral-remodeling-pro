"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { libraryTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Library...</div> }
);

export default function ArticlesPage() {
    return (
        <div className="flex flex-col w-full h-full relative">
            <ModuleTabs tabs={libraryTabs} groupId="library" />

            <div className="mx-6 mt-4 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Articles Master Library</h1>
            </div>

            <div className="w-full h-full flex flex-col pt-4 min-h-0">
                <DatabaseCloneDynamic databaseId="db-articles" />
            </div>
        </div>
    );
}
