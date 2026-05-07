"use client";

import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { libraryTabs } from "@/config/tabs";
import { useTenant } from "@/context/TenantContext";
import LockedFeature from "@/components/admin/LockedFeature";

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Library...</div> }
);

export default function ArticlesPage() {
    const { planType, isPro, resolveDbId } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={libraryTabs} groupId="library" />

            {!isPro ? (
                <LockedFeature
                    label="Article Library"
                    requiredPlan="PRO"
                    currentPlan={planType}
                    description="Access the Article Library to manage reusable items, pricing templates, and import catalogs for your quotations and invoices."
                />
            ) : (
                <div className="w-full flex-1 flex flex-col pt-4 min-h-0">
                    <DatabaseCloneDynamic databaseId={resolveDbId('db-articles')} />
                </div>
            )}
        </div>
    );
}
