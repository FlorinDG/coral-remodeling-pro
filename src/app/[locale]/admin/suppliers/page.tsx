"use client";

import ModuleTabs from "@/components/admin/ModuleTabs";
import { relationsTabs } from "@/config/tabs";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function SuppliersPage() {
    usePageTitle('Supplier Directory');

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={relationsTabs} groupId="relations" />
            <div className="w-full h-full p-6 pb-10">
                <div className="flex h-[600px] bg-white dark:bg-[#0a0a0a] w-full border border-neutral-200 dark:border-white/10 rounded-xl items-center justify-center text-neutral-500">
                    <p>Suppliers database will be implemented here.</p>
                </div>
            </div>
        </div>
    );
}
