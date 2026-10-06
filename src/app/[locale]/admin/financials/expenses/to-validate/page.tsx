"use client";

/**
 * VALIDATE-1 · "Te valideren" (Florin 2026-10-06, after Billit's antechamber: "fresh receipt scans don't reach the
 * expenses db directly"). Every scan and import of a ticket or a purchase document waits here until a person
 * approves it — only then does it count (lib/records/validation isValidated: totals, project costs, the accountant
 * export). Peppol arrivals never come here: they are validated at network level.
 */
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTenant } from '@/context/TenantContext';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">…</div> }
);

const PurchaseInvoiceEngine = dynamic(
    () => import('@/components/admin/expenses/PurchaseInvoiceEngine'),
    { ssr: false }
);

type Tab = 'tickets' | 'purchase';

export default function ToValidatePage() {
    const t = useTranslations('Admin');
    usePageTitle(t('nav.financialTabs.toValidate'));
    const { planType } = useTenant();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'purchase' ? 'purchase' : 'tickets');
    const [openPurchaseId, setOpenPurchaseId] = useState<string | null>(null);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="flex items-center gap-3 pt-5 px-1">
                {(['tickets', 'purchase'] as const).map(id => (
                    <button key={id} type="button" onClick={() => setTab(id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === id
                                ? 'bg-[var(--brand-color,#d35400)] text-white'
                                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                        {t(id === 'tickets' ? 'toValidate.tickets' : 'toValidate.purchaseInvoices')}
                    </button>
                ))}
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('toValidate.hint')}</p>
            </div>
            <div className="w-full flex-1 flex flex-col pt-4 min-h-0">
                {tab === 'tickets' ? (
                    <DatabaseCloneDynamic key="tickets" databaseId="db-tickets" validation="to-validate" hideFooterNew />
                ) : (
                    <DatabaseCloneDynamic key="purchase" databaseId="db-expenses" validation="to-validate" hideFooterNew
                                          onOpenRecord={id => setOpenPurchaseId(id)} />
                )}
            </div>
            {openPurchaseId && (
                <PurchaseInvoiceEngine pageId={openPurchaseId} onClose={() => setOpenPurchaseId(null)} />
            )}
        </div>
    );
}
