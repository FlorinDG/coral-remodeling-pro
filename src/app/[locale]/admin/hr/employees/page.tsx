"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";

export const hrTabs = [
    { label: 'Workhub', href: '/admin/hr/time-tracker', id: 'workhub' },
    { label: 'Employees', href: '/admin/hr/employees', id: 'employees' }
]; // Scheduler removed until it exists

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing HR Database...</div> }
);

export default function EmployeeDirectoryPage() {
    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={hrTabs} />
            <div className="w-full h-full p-6 pb-10">
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Employee Directory</h1>
                    <p className="text-sm text-neutral-500">Manage internal staff, track roles, and organize HR records.</p>
                </div>
                <DatabaseCloneDynamic databaseId="db-hr" />
            </div>
        </div>
    );
}
