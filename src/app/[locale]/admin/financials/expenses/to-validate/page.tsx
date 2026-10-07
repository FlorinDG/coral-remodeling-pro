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
import { useDatabaseStore } from '@/components/admin/database/store';
import { useShallow } from 'zustand/react/shallow';
import { isValidated } from '@/lib/records/validation';

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
    const { planType, resolveDbId } = useTenant();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'purchase' ? 'purchase' : 'tickets');
    // EDIT-1: tickets AND purchase documents open in the ONE side-by-side editor (document left, fields right)
    const [open, setOpen] = useState<{ id: string; databaseId: string } | null>(() => {
        // ?open=<id> — the import's row "open this document" (with ?tab= telling which database)
        const id = searchParams.get('open');
        return id ? { id, databaseId: resolveDbId(searchParams.get('tab') === 'purchase' ? 'db-expenses' : 'db-tickets') } : null;
    });
    // how many wait in each tab — the purchase tab is never missed again
    const waiting = useDatabaseStore(useShallow(st => ({
        tickets: (st.getDatabase(resolveDbId('db-tickets'))?.pages || []).filter(p => !isValidated(p.properties)).length,
        purchase: (st.getDatabase(resolveDbId('db-expenses'))?.pages || []).filter(p => !isValidated(p.properties)).length,
    })));

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="flex items-center gap-3 pt-5 px-1">
                {(['tickets', 'purchase'] as const).map(id => (
                    <button key={id} type="button" onClick={() => setTab(id)}
                            className={`h-10 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${tab === id
                                ? 'bg-[var(--brand-color,#d35400)] text-white'
                                : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}>
                        {t(id === 'tickets' ? 'toValidate.tickets' : 'toValidate.purchaseInvoices')}
                        <span className={`ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-xs ${tab === id ? 'bg-white/25' : 'bg-neutral-200 dark:bg-white/10'}`}>{waiting[id]}</span>
                    </button>
                ))}
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('toValidate.hint')}</p>
            </div>
            <div className="w-full flex-1 flex flex-col pt-4 min-h-0">
                {tab === 'tickets' ? (
                    <DatabaseCloneDynamic key="tickets" databaseId="db-tickets" validation="to-validate" hideFooterNew
                                          onOpenRecord={id => setOpen({ id, databaseId: resolveDbId('db-tickets') })} />
                ) : (
                    <DatabaseCloneDynamic key="purchase" databaseId="db-expenses" validation="to-validate" hideFooterNew
                                          onOpenRecord={id => setOpen({ id, databaseId: resolveDbId('db-expenses') })} />
                )}
            </div>
            {open && (
                <PurchaseInvoiceEngine pageId={open.id} databaseId={open.databaseId} onClose={() => setOpen(null)} />
            )}
        </div>
    );
}
