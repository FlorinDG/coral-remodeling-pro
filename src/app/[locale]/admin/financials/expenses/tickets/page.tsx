"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { createPageServerFirst } from '@/app/actions/pages';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Tickets Database...</div> }
);

const AiDocumentImportModal = dynamic(
    () => import('@/components/admin/expenses/AiDocumentImportModal'),
    { ssr: false }
);

const TicketCaptureModal = dynamic(
    () => import('@/components/admin/expenses/TicketCaptureModal'),
    { ssr: false }
);

export default function ExpenseTicketsPage() {
    usePageTitle('Expense Tickets');
    const [showCapture, setShowCapture] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
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

    const handleAction = useCallback((actionId: string) => {
        if (actionId === 'scan-ticket') {
            setShowCapture(true);
        } else if (actionId === 'bulk-upload-tickets') {
            setShowBulk(true);
        } else if (actionId === 'manual-ticket') {
            handleNewManual();
        }
    }, [handleNewManual]);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-tickets" onAction={handleAction} />
            </div>

            {/* Ticket capture modal */}
            {showBulk && (
                <AiDocumentImportModal targetDatabaseId="db-tickets" onClose={() => setShowBulk(false)} onComplete={() => setShowBulk(false)} />
            )}

            {showCapture && (
                <TicketCaptureModal onClose={() => setShowCapture(false)} />
            )}
        </div>
    );
}
