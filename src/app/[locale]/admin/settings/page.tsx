import React from 'react';
import SettingsModule from '@/components/admin/settings/SettingsModule';
import { getTranslations } from "next-intl/server";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { settingsTabs } from "@/config/tabs";

export default async function AdminSettingsPage() {
    const t = await getTranslations("admin.settings");

    return (
        <div className="flex flex-col w-full h-full">
            <div className="px-6 pt-6 mb-2">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Admin Settings</h1>
                <p className="text-sm text-neutral-500 mt-1">Configure global platform integrations and back-office preferences.</p>
            </div>

            <ModuleTabs tabs={settingsTabs} groupId="settings" />

            <div className="p-6 h-full min-h-[calc(100vh-14rem)]">
                <SettingsModule />
            </div>
        </div>
    );
}
