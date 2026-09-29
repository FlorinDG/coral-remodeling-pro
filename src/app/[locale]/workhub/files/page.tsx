"use client";

import dynamic from "next/dynamic";

/**
 * WorkHub — Documents (WH-2).
 * The shared crew folder only. The admin File Manager (which listed every tenant file) is no
 * longer shown here; the office keeps it at /admin/files.
 */
const DocumentsScreen = dynamic(
    () => import("@/components/workhub/screens/DocumentsScreen").then(m => m.DocumentsScreen),
    { ssr: false }
);

export default function WorkHubFilesPage() {
    return <DocumentsScreen />;
}
