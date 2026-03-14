import React from 'react';
import SettingsModule from '@/components/admin/settings/SettingsModule';
import { getTranslations } from "next-intl/server";

export default async function AdminSettingsPage() {
    const t = await getTranslations("admin.settings");

    return (
        <div className="h-full flex flex-col min-h-[calc(100vh-8rem)]">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Admin Settings</h1>
                <p className="text-sm text-neutral-500 mt-1">Configure global platform integrations and back-office preferences.</p>
            </div>

            <SettingsModule />
        </div>
    );
}
