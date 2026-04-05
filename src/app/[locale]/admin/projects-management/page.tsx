'use client';

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full min-h-[500px] border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse bg-neutral-100/50 dark:bg-white/5" />
    }
);

export default function ProjectManagementPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />
            <div className="w-full h-full flex flex-col pt-6 pb-6 px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden relative isolate">
                    <DatabaseCloneDynamic
                        databaseId="db-1"
                        hideViewTabs={false}
                    />
                </div>
            </div>
        </div>
    );
}
