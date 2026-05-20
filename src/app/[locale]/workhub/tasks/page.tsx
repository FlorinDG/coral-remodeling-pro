"use client";

import dynamic from "next/dynamic";

const TaskModuleShell = dynamic(
    () => import("@/components/admin/tasks/TaskModuleShell"),
    { ssr: false }
);

/**
 * WorkHub Tasks — re-uses the full Task Manager from the admin module.
 * Employees can see and manage their assigned tasks directly from WorkHub.
 */
export default function WorkHubTasksPage() {
    return (
        <div className="w-full h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)]">
            <TaskModuleShell />
        </div>
    );
}
