'use client';

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import { FolderKanban } from "lucide-react";
import NewProjectButton from "../components/NewProjectButton";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full min-h-[500px] border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse bg-neutral-100/50 dark:bg-white/5" />
    }
);

export default function InternalProjectsPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />

            <div className="w-full h-full p-4 lg:p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#d35400]/10 text-[#d35400] rounded-xl flex items-center justify-center">
                            <FolderKanban className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Active Projects Database</h1>
                            <p className="text-neutral-500 font-medium text-xs mt-0.5">Live operational workspace tracking lifecycles and financials</p>
                        </div>
                    </div>
                    <NewProjectButton />
                </div>

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
