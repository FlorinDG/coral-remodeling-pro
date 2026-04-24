"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { Plus, Camera, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { createPageServerFirst } from '@/app/actions/pages';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Tickets Database...</div> }
);

const TicketCaptureModal = dynamic(
    () => import('@/components/admin/expenses/TicketCaptureModal'),
    { ssr: false }
);

export default function ExpenseTicketsPage() {
    usePageTitle('Expense Tickets');
    const [showCapture, setShowCapture] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const t = useTranslations('Admin');
    const { planType, resolveDbId } = useTenant();
    const ticketsDbId = resolveDbId('db-tickets');
    const addConfirmedPage = useDatabaseStore(s => s.addConfirmedPage);

    const handleNewManual = useCallback(async () => {
        if (isCreating) return;
        setIsCreating(true);
        try {
            const result = await createPageServerFirst(ticketsDbId, {
                source: 'src-manual',
                status: 'opt-unpaid',
                date: new Date().toISOString().split('T')[0],
            });
            if (result.success) {
                addConfirmedPage(result.page);
            }
        } catch (e) {
            console.error('[handleNewManual ticket] failed:', e);
        } finally {
            setIsCreating(false);
        }
    }, [isCreating, addConfirmedPage, ticketsDbId]);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="w-full flex-1 flex flex-col min-h-0">
                {/* Action bar */}
                <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0">
                    <button
                        onClick={() => setShowCapture(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 border border-orange-200 dark:border-orange-800/30 text-orange-700 dark:text-orange-300 text-xs font-bold rounded-lg transition-colors"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        {t('nav.pages.scanUploadTicket') || 'Scan / Upload Ticket'}
                    </button>
                    <button
                        onClick={handleNewManual}
                        disabled={isCreating}
                        className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                    >
                        {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        {t('nav.pages.manualTicket') || 'Manual Entry'}
                    </button>
                </div>

                {/* Database grid */}
                <div className="flex-1 min-h-0">
                    <DatabaseCloneDynamic databaseId="db-tickets" />
                </div>
            </div>

            {/* Ticket capture modal */}
            {showCapture && (
                <TicketCaptureModal onClose={() => setShowCapture(false)} />
            )}
        </div>
    );
}
