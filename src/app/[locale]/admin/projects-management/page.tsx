'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useLocale, useTranslations } from 'next-intl';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { projectsTabs } from "@/config/tabs";
import { useDatabaseStore } from '@/components/admin/database/store';
import type { ScreenTabItem } from '@/lib/records/db-header';
import { canonicalSchemas } from '@/lib/kernel/system-schemas';

const ProjectDetailView = dynamic(
    () => import('@/components/admin/database/components/ProjectDetailView'),
    { ssr: false }
);

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full min-h-[500px] border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse bg-neutral-100/50 dark:bg-white/5" />
    }
);

export default function ProjectManagementPage() {
    const locale = useLocale();
    const t = useTranslations('Admin.dbHeader');
    const { resolveDbId } = useTenant();
    const [activeType, setActiveType] = useState<string>('all');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const resolvedDbId = resolveDbId('db-1');
    const projectDb = useDatabaseStore(state => state.getDatabase(resolvedDbId));
    const typeProp = projectDb?.properties.find(p => p.id === 'prop-project-type');
    const fallbackOptions = (canonicalSchemas(resolveDbId)['db-1']?.find(
        p => p.id === 'prop-project-type'
    )?.config?.options as Array<{ id: string; name: string }>) || [];
    const typeOptions = (typeProp?.config?.options as Array<{ id: string; name: string }> | undefined) || fallbackOptions;

    const screenTabs: ScreenTabItem[] = [
        { id: 'all', label: t('all'), active: activeType === 'all' },
        ...typeOptions.map(opt => ({
            id: opt.id,
            label: opt.name,
            active: activeType === opt.id,
            filterValue: opt.id,
        })),
    ];

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={projectsTabs} groupId="projects" />

            <div className="w-full flex-1 flex flex-col pt-6 pb-6 px-3 md:px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                {/* Database grid */}
                <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 overflow-hidden relative isolate">
                    <DatabaseCloneDynamic
                        key={activeType}
                        databaseId="db-1"
                        screenTabs={screenTabs}
                        onSelectScreenTab={setActiveType}
                        defaultFilter={activeType !== 'all' ? { propertyId: 'prop-project-type', value: activeType } : undefined}
                        onOpenRecord={(id) => setSelectedProjectId(id)}
                    />
                </div>
            </div>

            {selectedProjectId && (
                <ProjectDetailView
                    databaseId={resolvedDbId}
                    pageId={selectedProjectId}
                    locale={locale}
                    onClose={() => setSelectedProjectId(null)}
                />
            )}
        </div>
    );
}
