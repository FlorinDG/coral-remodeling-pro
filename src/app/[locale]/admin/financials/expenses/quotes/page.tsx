"use client";

/**
 * QUOTE-IN-1 · Offertes leveranciers (Florin 2026-10-08: "a db for quotes inbound … from there i can extract materials
 * for library. searchable, like the purchase invoices"). Its own database (kernel 'purchase-quotes') — never a cost,
 * never validated or exported. Scanned / imported like a purchase invoice; opened in the one purchase editor, which
 * shows a quote's fields only (lib/records/purchase-document).
 */
import React, { useState, useCallback } from "react";
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

const AiDocumentImportModal = dynamic(
    () => import('@/components/admin/expenses/AiDocumentImportModal'),
    { ssr: false }
);

const PurchaseLineSearch = dynamic(
    () => import('@/components/admin/expenses/PurchaseLineSearch'),
    { ssr: false }
);

export default function SupplierQuotesPage() {
    const t = useTranslations('Admin');
    usePageTitle(t('nav.financialTabs.supplierQuotes'));
    const { planType, resolveDbId } = useTenant();
    const searchParams = useSearchParams();
    const [openId, setOpenId] = useState<string | null>(searchParams.get('open'));
    const [showImport, setShowImport] = useState(false);
    // LINE-SEARCH-1: the line search, and a found line's document (a quote OR a purchase invoice) in the editor
    const [showLineSearch, setShowLineSearch] = useState(false);
    const [lineDoc, setLineDoc] = useState<{ id: string; databaseId: string } | null>(null);

    const handleAction = useCallback((actionId: string) => {
        if (actionId === 'scan-invoice') setShowImport(true);
        else if (actionId === 'search-lines') setShowLineSearch(true);
    }, []);

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic
                    databaseId="db-purchase-quotes"
                    hideFooterNew
                    onOpenRecord={(id) => setOpenId(id)}
                    onAction={handleAction}
                />
            </div>
            {openId && (
                <PurchaseInvoiceEngine pageId={openId} databaseId={resolveDbId('db-purchase-quotes')} onClose={() => setOpenId(null)} />
            )}
            {showLineSearch && (
                <PurchaseLineSearch onClose={() => setShowLineSearch(false)} onOpenDocument={(databaseId, id) => setLineDoc({ id, databaseId })} />
            )}
            {lineDoc && (
                <PurchaseInvoiceEngine pageId={lineDoc.id} databaseId={lineDoc.databaseId} onClose={() => setLineDoc(null)} />
            )}
            {showImport && (
                <AiDocumentImportModal targetDatabaseId="db-purchase-quotes" onClose={() => setShowImport(false)} />
            )}
        </div>
    );
}
