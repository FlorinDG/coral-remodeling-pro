"use client";

import dynamic from "next/dynamic";

/**
 * WorkHub — My tasks (WH-2).
 * A phone-native, read-only list of the tasks assigned to the worker. The admin Task Manager
 * is no longer shown to the crew (it stays at /admin/tasks and /m/tasks for the office).
 */
const MyTasksScreen = dynamic(
    () => import("@/components/workhub/screens/MyTasksScreen").then(m => m.MyTasksScreen),
    { ssr: false }
);

export default function WorkHubTasksPage() {
    return <MyTasksScreen />;
}
