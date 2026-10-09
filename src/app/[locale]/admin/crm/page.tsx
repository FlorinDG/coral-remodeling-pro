"use client";

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import LockedFeature from "@/components/admin/LockedFeature";
import ModuleTabs from "@/components/admin/ModuleTabs";
import { salesTabs } from "@/config/tabs";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing CRM Environment...</div> }
);

export default function CRMPage() {
    usePageTitle('CRM Module');
    const { planType, isPro, isEnterprise, resolveDbId } = useTenant();
    const [activeDb, setActiveDb] = useState<'db-crm' | 'db-bobex'>('db-crm');

    const isMultiPipelineAllowed = isEnterprise || planType === 'FOUNDER' || planType === 'CUSTOM';
    const resolvedDb = isMultiPipelineAllowed ? activeDb : 'db-crm';

    const crmDb = useDatabaseStore(state => state.getDatabase(resolveDbId('db-crm')));
    const bobexDb = useDatabaseStore(state => state.getDatabase(resolveDbId('db-bobex')));

    const screenTabs = isMultiPipelineAllowed ? [
        {
            id: 'db-crm',
            label: crmDb?.name || 'CRM',
            active: resolvedDb === 'db-crm',
        },
        {
            id: 'db-bobex',
            label: bobexDb?.name || 'Bobex',
            active: resolvedDb === 'db-bobex',
        },
    ] : null;

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={salesTabs} groupId="sales" />

            {!isPro ? (
                <LockedFeature
                    label="Sales Pipeline"
                    requiredPlan="PRO"
                    currentPlan={planType}
                    description="Manage your sales pipeline with customizable stages, deal tracking, and revenue forecasting. PRO gets 1 pipeline; ENTERPRISE gets unlimited pipelines with automation."
                />
            ) : (
                <div className="w-full flex-1 flex flex-col pt-6 pb-6 px-3 md:px-6 min-h-0 bg-neutral-50/50 dark:bg-black/50">
                    <div className="flex-1 w-full min-h-0 bg-white dark:bg-black rounded-2xl shadow-sm border border-neutral-200 dark:border-white/10 relative">
                        <DatabaseCloneDynamic
                            key={resolvedDb}
                            databaseId={resolvedDb}
                            screenTabs={screenTabs}
                            onSelectScreenTab={(id) => setActiveDb(id as 'db-crm' | 'db-bobex')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
