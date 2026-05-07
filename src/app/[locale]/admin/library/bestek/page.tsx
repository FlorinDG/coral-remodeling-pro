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

export default function BestekPage() {
    const { planType, isPro, resolveDbId } = useTenant();

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={libraryTabs} groupId="library" />

            {!isPro ? (
                <LockedFeature
                    label="Bestek / Posten"
                    requiredPlan="PRO"
                    currentPlan={planType}
                    description="Standardized technical specifications and building codes. PRO tenants get read-only catalog access; ENTERPRISE tenants can edit and create custom Bestek entries."
                />
            ) : (
                <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold">Bestek (Specifications) Library</h1>
                        <p className="text-sm text-neutral-500">Standardized technical specifications and building codes context.</p>
                    </div>
                    <DatabaseCloneDynamic databaseId={resolveDbId('db-bestek')} />
                </div>
            )}
        </div>
    );
}
