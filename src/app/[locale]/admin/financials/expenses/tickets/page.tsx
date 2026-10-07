"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTenant } from '@/context/TenantContext';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Tickets Database...</div> }
);

const AiDocumentImportModal = dynamic(
    () => import('@/components/admin/expenses/AiDocumentImportModal'),
    { ssr: false }
);

// EDIT-1: a ticket opens in the ONE side-by-side purchase-document editor (document left, fields right)
const PurchaseInvoiceEngine = dynamic(
    () => import('@/components/admin/expenses/PurchaseInvoiceEngine'),
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
    const [openId, setOpenId] = useState<string | null>(null);
    const { planType, resolveDbId } = useTenant();
    const ticketsDbId = resolveDbId('db-tickets');

    const handleAction = useCallback((actionId: string) => {
        if (actionId === 'scan-ticket') {
            setShowCapture(true);
        } else if (actionId === 'bulk-upload-tickets') {
            setShowBulk(true);
        }
    }, []);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic databaseId="db-tickets" onAction={handleAction} validation="validated" onOpenRecord={id => setOpenId(id)} hideFooterNew />
            </div>

            {openId && <PurchaseInvoiceEngine pageId={openId} databaseId={ticketsDbId} onClose={() => setOpenId(null)} />}

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
