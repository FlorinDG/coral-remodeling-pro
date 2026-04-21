"use client";

import React from 'react';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useTenant } from "@/context/TenantContext";
import LockedFeature from "@/components/admin/LockedFeature";

export default function FilesPage() {
    const { planType, isPro } = useTenant();

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between px-8 py-4 border-b border-neutral-200 dark:border-white/10 bg-white dark:bg-black">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Global Library</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Manage all your centralized assets, marketing materials, and project files.
                    </p>
                </div>
            </div>

            {!isPro ? (
                <LockedFeature
                    label="File Manager"
                    requiredPlan="PRO"
                    currentPlan={planType}
                    description="Upload, organize, and share files across your workspace. Auto-generated PDFs from invoices and quotations are always accessible on all plans."
                />
            ) : (
                <div className="flex-1 w-full h-full overflow-hidden relative">
                    <FileManager />
                </div>
            )}
        </div>
    );
}
