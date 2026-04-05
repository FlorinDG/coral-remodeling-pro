import React from 'react';
import { getTranslations } from "next-intl/server";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { settingsTabs } from "@/config/tabs";
import DocumentTemplatesModule from '@/components/admin/settings/DocumentTemplatesModule';

export default async function AdminTemplatesSettingsPage() {
    const t = await getTranslations("admin.settings");

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={settingsTabs} groupId="settings" />
            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-neutral-50/50 dark:bg-[#0a0a0a]">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Document Templates</h1>
                    <p className="text-sm text-neutral-500 mt-1">Configure global visual appearance, branding, and layouts for all exported PDF documents.</p>
                </div>
                <DocumentTemplatesModule />
            </div>
        </div>
    );
}
