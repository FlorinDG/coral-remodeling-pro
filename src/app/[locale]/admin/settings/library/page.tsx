"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { settingsTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Settings } from 'lucide-react';

export default function LibrarySettingsPage() {
    usePageTitle('Library Settings');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={settingsTabs} groupId="settings" />
            <div className="w-full h-full p-6 pb-10 flex flex-col items-center justify-center text-neutral-500">
                <Settings className="w-12 h-12 mb-4 opacity-50" />
                <h2 className="text-xl font-medium tracking-tight">Library Settings Configuration</h2>
                <p className="mt-2 text-sm max-w-md text-center">This section will house all administrative configurations for the library module.</p>
            </div>
        </div>
    );
}
