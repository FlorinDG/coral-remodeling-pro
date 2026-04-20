"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import { Calendar } from "lucide-react";
import dynamic from "next/dynamic";

const GanttViewDynamic = dynamic(
    () => import('@/components/admin/database/views/GanttView'),
    { ssr: false, loading: () => <div className="text-neutral-500 p-8 font-medium">Loading SVAR timeline engine...</div> }
);

export default function ProjectPlanningPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />

            <div className="w-full flex-1 flex flex-col pt-6 px-6 pb-10 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                <div className="mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Planning & Timeline</h1>
                        <p className="text-xs text-neutral-500 font-medium mt-0.5">Master schedule charting planned baselines against real execution durations.</p>
                    </div>
                </div>

                <div className="flex-1 min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden flex flex-col mt-4">
                    <GanttViewDynamic databaseId="db-1" viewId="view-5" />
                </div>
            </div>
        </div>
    );
}
