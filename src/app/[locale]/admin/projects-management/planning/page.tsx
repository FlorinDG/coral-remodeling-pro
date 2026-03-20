"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import dynamic from 'next/dynamic';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Planning Database...</div> }
);

export default function ProjectPlanningPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} />
            <div className="w-full h-full flex flex-col pt-6 min-h-0">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Project Planning</h1>
                    <p className="text-sm text-neutral-500">Long-term master scheduling and milestone planning for active projects.</p>
                </div>

                <DatabaseCloneDynamic databaseId="db-1" />
            </div>
        </div>
    );
}
