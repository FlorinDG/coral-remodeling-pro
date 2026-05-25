'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import { Layers3, Hammer, Briefcase, Rocket } from 'lucide-react';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full min-h-[500px] border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse bg-neutral-100/50 dark:bg-white/5" />
    }
);

type ProjectTypeFilter = 'all' | 'operations' | 'admin' | 'bizdev';

const TYPE_TABS: { id: ProjectTypeFilter; label: string; icon: React.ReactNode; filterValue?: string }[] = [
    { id: 'all', label: 'All Projects', icon: <Layers3 className="w-4 h-4" /> },
    { id: 'operations', label: 'Operations', icon: <Hammer className="w-4 h-4" />, filterValue: 'type-operations' },
    { id: 'admin', label: 'Administration', icon: <Briefcase className="w-4 h-4" />, filterValue: 'type-admin' },
    { id: 'bizdev', label: 'Business Dev', icon: <Rocket className="w-4 h-4" />, filterValue: 'type-bizdev' },
];

export default function ProjectManagementPage() {
    const [activeType, setActiveType] = useState<ProjectTypeFilter>('all');
    const activeTab = TYPE_TABS.find(t => t.id === activeType) || TYPE_TABS[0];

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />

            <div className="w-full flex-1 flex flex-col pt-6 pb-6 px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                {/* Type filter tabs */}
                <div className="flex items-center gap-1 mb-4 overflow-x-auto no-scrollbar">
                    {TYPE_TABS.map((tab) => {
                        const isActive = tab.id === activeType;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveType(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm border border-neutral-200 dark:border-white/10'
                                        : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                                style={isActive ? { borderBottomColor: 'var(--brand-color, #d35400)', boxShadow: `0 2px 0 0 var(--brand-color, #d35400)` } : {}}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Database grid */}
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden relative isolate">
                    <DatabaseCloneDynamic
                        key={activeType}
                        databaseId="db-1"
                        hideViewTabs={false}
                        defaultFilter={activeTab.filterValue ? { propertyId: 'prop-project-type', value: activeTab.filterValue } : undefined}
                    />
                </div>
            </div>
        </div>
    );
}
