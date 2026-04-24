"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredSettingsTabs } from '@/config/tabs';
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ListChecks, Settings } from 'lucide-react';

export default function TasksSettingsPage() {
    usePageTitle('Tasks Settings');
    const { activeModules } = useTenant();
    const filteredSettingsTabs = getFilteredSettingsTabs(activeModules);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={filteredSettingsTabs} groupId="settings" />
            <div className="flex-1 overflow-y-auto p-6 pb-16 bg-neutral-50/50 dark:bg-[#0a0a0a]">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/10 flex items-center justify-center">
                            <ListChecks className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Tasks Settings</h1>
                            <p className="text-xs text-neutral-500">Task manager and workflow configuration.</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-200 dark:border-white/10 p-8 text-center">
                        <Settings className="w-10 h-10 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                        <p className="text-sm font-medium text-neutral-500">Module-specific settings will appear here as features are built.</p>
                        <p className="text-xs text-neutral-400 mt-1">Data access control for this module is managed in Team settings.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
