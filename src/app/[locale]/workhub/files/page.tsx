"use client";

import dynamic from "next/dynamic";

const FileManager = dynamic(
    () => import("@/components/admin/file-manager/FileManager"),
    { ssr: false }
);

/**
 * WorkHub Files — re-uses the Unified File Manager.
 * Employees can access documents shared at the team level.
 */
export default function WorkHubFilesPage() {
    return (
        <div className="max-w-6xl mx-auto px-4 py-4">
            <h1 className="text-xl font-black tracking-tight mb-4 text-neutral-900 dark:text-white">Documents & Files</h1>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 12rem)' }}>
                <FileManager contextType="global" contextId="workhub-shared" />
            </div>
        </div>
    );
}
