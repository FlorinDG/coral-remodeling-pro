"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

export const projectsTabs = [
    { label: 'PROJECTS DATABASE', href: '/admin/projects-management/tasks', id: 'database' },
    { label: 'PLANNING TIMELINE', href: '/admin/projects-management/planning', id: 'planning' }
];

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Tasks Database...</div> }
);

export default function TasksPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Tasks</h1>
                    <p className="text-sm text-neutral-500">Manage daily action items, sub-tasks, and individual assignments.</p>
                </div>
                <DatabaseCloneDynamic databaseId="db-tasks" />
            </div>
        </div>
    );
}
