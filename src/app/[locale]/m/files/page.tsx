"use client";

import React from 'react';
import FileManager from '@/components/admin/file-manager/FileManager';
import { useTenant } from "@/context/TenantContext";
import LockedFeature from "@/components/admin/LockedFeature";
import { FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function MobileFilesPage() {
    const { planType, isPro } = useTenant();
    const t = useTranslations();

    return (
        <div className="flex flex-col h-screen w-full bg-neutral-50 dark:bg-black">
            <div className="flex-none pt-safe bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 sticky top-0 z-20">
                <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                            Global Library
                        </h1>
                        <p className="text-[11px] font-medium text-neutral-500">
                            Search and manage your files
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {!isPro ? (
                    <div className="p-4">
                        <LockedFeature
                            label="File Manager"
                            requiredPlan="PRO"
                            currentPlan={planType}
                            description="Upload, organize, and share files across your workspace. Auto-generated PDFs from invoices and quotations are always accessible on all plans."
                        />
                    </div>
                ) : (
                    <div className="w-full h-full pb-20">
                        <FileManager />
                    </div>
                )}
            </div>
        </div>
    );
}
