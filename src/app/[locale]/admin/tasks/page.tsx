'use client';

import dynamic from 'next/dynamic';
import { FolderKanban } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import LockedFeature from "@/components/admin/LockedFeature";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full min-h-[500px] border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse bg-neutral-100/50 dark:bg-white/5" />
    }
);

export default function TasksPage() {
    const { planType, isPro } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            <div className="w-full h-full p-4 lg:p-6 pb-10 flex flex-col hide-scrollbar overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--brand-color,#d35400)]/10 text-[var(--brand-color,#d35400)] rounded-xl flex items-center justify-center">
                            <FolderKanban className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Workspace Task Manager</h1>
                            <p className="text-neutral-500 font-medium text-xs mt-0.5">Cross-functional Kanban, lists, and task tracking mapped to your live projects.</p>
                        </div>
                    </div>
                </div>

                {!isPro ? (
                    <LockedFeature
                        label="Task Manager"
                        requiredPlan="PRO"
                        currentPlan={planType}
                        description="Create, assign, and track tasks across your workspace. PRO gets standalone task management; ENTERPRISE adds relations, rollups, and workforce assignment."
                    />
                ) : (
                    <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden relative isolate">
                        <DatabaseCloneDynamic
                            databaseId="db-tasks"
                            hideViewTabs={false}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
