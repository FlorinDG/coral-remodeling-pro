"use client";

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createProforma } from '@/app/actions/proforma-invoice';
import { useDatabaseStore } from '@/components/admin/database/store';
import type { Page } from '@/components/admin/database/types';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { useTenant } from '@/context/TenantContext';
import { usePageTitle } from '@/hooks/usePageTitle';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Proforma Invoices...</div> }
);

export default function ProformaInvoicesPage() {
    usePageTitle('Proforma Invoices');

    const { planType } = useTenant();
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    // PROFORMA-2: "Nieuwe proforma" — numbered PF-YYYY-NNN by the server (the record door), then opened in the editor
    const handleAction = useCallback(async (actionId: string) => {
        if (actionId !== 'new-proforma' || creating) return;
        setCreating(true);
        try {
            const r = await createProforma();
            if (!r.ok) { toast.error(r.error === 'forbidden' ? 'Je mag hier geen proforma maken.' : 'Proforma kon niet gemaakt worden.'); return; }
            useDatabaseStore.getState().addConfirmedPage({ ...r.page, order: 0, createdAt: r.page.updatedAt, createdBy: 'user', lastEditedBy: 'user' } as unknown as Page);
            router.push(`/admin/financials/income/invoices/${r.id}`);
        } finally { setCreating(false); }
    }, [creating, router]);

    return (
        <div className="flex flex-col w-full h-full">
            <div className="relative">
                <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            </div>
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-invoices" hideFooterNew defaultFilter={{ propertyId: 'docType', value: 'opt-proforma' }} onAction={handleAction} />
            </div>
        </div>
    );
}
