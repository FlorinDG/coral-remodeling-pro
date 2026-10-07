"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import PeppolQuotaBanner from '@/components/admin/PeppolQuotaBanner';
import { useTenant } from '@/context/TenantContext';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

import { Page } from '@/components/admin/database/types';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Database...</div> }
);

const PurchaseInvoiceEngine = dynamic(
    () => import('@/components/admin/expenses/PurchaseInvoiceEngine'),
    { ssr: false }
);

const AiDocumentImportModal = dynamic(
    () => import('@/components/admin/expenses/AiDocumentImportModal'),
    { ssr: false }
);

export default function ExpensesInvoicesPage() {
    usePageTitle('Purchase Invoices');
    const t = useTranslations('Admin');

    const { planType } = useTenant();

    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ count: number; error?: string } | null>(null);
    const searchParams = useSearchParams();
    const openParam = searchParams.get("open");
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(openParam);
    const [showScanUpload, setShowScanUpload] = useState(false);
    const [quotaWarning, setQuotaWarning] = useState<{
        overQuota: boolean; current: number; limit: number; plan: string;
    } | null>(null);

    const addConfirmedPage = useDatabaseStore(s => s.addConfirmedPage);

    // ── Peppol connection status (checked on mount) ────────────────────────
    const [peppolStatus, setPeppolStatus] = useState<{
        loading: boolean;
        connected: boolean;
        peppolRegistered: boolean;
        peppolId?: string;
        companyName?: string;
    }>({ loading: true, connected: false, peppolRegistered: false });

    useEffect(() => {
        fetch('/api/peppol/onboard')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setPeppolStatus({
                        loading: false,
                        connected: data.connected,
                        peppolRegistered: data.peppolRegistered,
                        peppolId: data.peppolId,
                        companyName: data.companyName,
                    });
                } else {
                    setPeppolStatus(s => ({ ...s, loading: false }));
                }
            })
            .catch(() => setPeppolStatus(s => ({ ...s, loading: false })));
    }, []);

    const handleSyncPeppol = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/peppol/inbox');
            const data = await res.json();

            if (!res.ok) {
                setSyncResult({ count: 0, error: data.error || t('nav.pages.peppolSyncError') });
                return;
            }

            // Surface quota warning if FREE tenant is over received limit
            if (data.quota) setQuotaWarning(data.quota);

            // Add newly imported pages automatically returned from server-side sync
            const newlyImportedPages = data.newlyImportedPages || [];
            if (newlyImportedPages.length > 0) {
                newlyImportedPages.forEach((page: Page) => {
                    addConfirmedPage(page);
                });
            }

            setSyncResult({ count: data.newlyImportedCount || 0 });
        } catch (err: unknown) {
            setSyncResult({ count: 0, error: (err as Error).message || t('nav.pages.peppolSyncError') });
        } finally {
            setSyncing(false);
        }
    }, [syncing, addConfirmedPage, t]);

    // Automatically sync Peppol inbox in the background on mount / when Peppol is ready
    const isPeppolReady = peppolStatus.connected && peppolStatus.peppolRegistered;

    useEffect(() => {
        if (isPeppolReady) {
            handleSyncPeppol();
        }
    }, [isPeppolReady, handleSyncPeppol]);

    const handleAction = useCallback((actionId: string) => {
        if (actionId === 'scan-invoice') {
            setShowScanUpload(true);
        } else if (actionId === 'peppol-sync') {
            handleSyncPeppol();
        }
    }, [handleSyncPeppol]);

    const peppolHeaderExtra = (
        <div className="flex items-center gap-2">
            {/* Sync result badge */}
            {syncResult && (
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                    syncResult.error
                        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                        : 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400'
                }`}>
                    {syncResult.error
                        ? `⚠️ ${syncResult.error}`
                        : syncResult.count > 0
                            ? `✓ ${t('nav.pages.peppolSyncSuccess', { count: syncResult.count })}`
                            : `✓ ${t('nav.pages.peppolInboxUpToDate')}`
                    }
                </div>
            )}

            {/* Peppol connection status badge */}
            {!peppolStatus.loading && (
                isPeppolReady ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('nav.pages.peppolConnectedBadge')}</span>
                        {peppolStatus.peppolId && (
                            <code className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 font-mono text-[10px]">
                                {peppolStatus.peppolId}
                            </code>
                        )}
                    </div>
                ) : (
                    <Link
                        href="/admin/settings/company-info"
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t('nav.pages.peppolNotConfigured')}
                    </Link>
                )
            )}
        </div>
    );

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />

            {/* Peppol received quota banner — shown between tabs and header */}
            {quotaWarning?.overQuota && (
                <PeppolQuotaBanner
                    type="received"
                    current={quotaWarning.current}
                    limit={quotaWarning.limit!}
                    plan={quotaWarning.plan}
                />
            )}
            <div className="w-full flex-1 flex flex-col pt-6 min-h-0">
                <DatabaseCloneDynamic
                    databaseId="db-expenses"
                    defaultFilter={{ propertyId: 'docType', value: 'opt-invoice' }}
                    validation="validated"
                    hideFooterNew
                    onOpenRecord={(id) => setSelectedInvoiceId(id)}
                    headerExtra={peppolHeaderExtra}
                    onAction={handleAction}
                />
            </div>

            {/* Purchase Invoice Engine modal */}
            {selectedInvoiceId && (
                <PurchaseInvoiceEngine
                    pageId={selectedInvoiceId}
                    onClose={() => setSelectedInvoiceId(null)}
                />
            )}

            {/* Scan / Upload invoice modal */}
            {showScanUpload && (
                <AiDocumentImportModal
                    targetDatabaseId="db-expenses"
                    onClose={() => setShowScanUpload(false)}
                />
            )}
        </div>
    );
}
