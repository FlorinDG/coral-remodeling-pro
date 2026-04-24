"use client";

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ModuleTabs from "@/components/admin/ModuleTabs";
import { getFilteredFinancialTabs } from "@/config/tabs";
import { usePageTitle } from '@/hooks/usePageTitle';
import { RefreshCw, Plus, Loader2, Camera, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import PeppolQuotaBanner from '@/components/admin/PeppolQuotaBanner';
import { createPageServerFirst } from '@/app/actions/pages';
import { useTenant } from '@/context/TenantContext';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const DatabaseCloneDynamic = dynamic(
    () => import('@/components/admin/database/DatabaseClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Database...</div> }
);

const PurchaseInvoiceEngine = dynamic(
    () => import('@/components/admin/expenses/PurchaseInvoiceEngine'),
    { ssr: false }
);

const TicketCaptureModal = dynamic(
    () => import('@/components/admin/expenses/TicketCaptureModal'),
    { ssr: false }
);

export default function ExpensesInvoicesPage() {
    usePageTitle('Purchase Invoices');
    const t = useTranslations('Admin');

    const { resolveDbId, planType } = useTenant();
    const expensesDbId = resolveDbId('db-expenses');

    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ count: number; error?: string } | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [showScanUpload, setShowScanUpload] = useState(false);
    const [quotaWarning, setQuotaWarning] = useState<{
        overQuota: boolean; current: number; limit: number; plan: string;
    } | null>(null);

    const addConfirmedPage = useDatabaseStore(s => s.addConfirmedPage);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

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

            const existingDb = useDatabaseStore.getState().getDatabase(expensesDbId);
            const existingPeppolIds = new Set(
                (existingDb?.pages || [])
                    .filter(p => p.properties.peppolDocId)
                    .map(p => String(p.properties.peppolDocId))
            );

            let imported = 0;
            for (const doc of (data.documents || [])) {
                if (existingPeppolIds.has(doc.id)) continue;

                const parsed = doc.parsed;
                if (!parsed) continue;

                const result = await createPageServerFirst(expensesDbId, {
                    title: parsed.invoiceNumber || doc.invoice_number || doc.id,
                    betreft: parsed.lines?.[0]?.description || '',
                    source: 'src-peppol',
                    status: 'opt-unpaid',
                    invoiceDate: parsed.issueDate || doc.issue_date || '',
                    dueDate: parsed.dueDate || doc.due_date || '',
                    totalExVat: parsed.totalExVat || 0,
                    totalVat: parsed.totalVat || 0,
                    totalIncVat: parsed.totalIncVat || doc.total_amount || 0,
                    peppolDocId: doc.id,
                    invoiceLines: JSON.stringify(parsed.lines || []),
                    supplierName: parsed.supplierName || doc.sender_name || '',
                    supplierVat: parsed.supplierVat || doc.sender_peppol_id || '',
                    supplier: doc.matchedSupplierId ? [doc.matchedSupplierId] : [],
                });

                if (result.success) {
                    addConfirmedPage(result.page);
                    imported++;
                } else {
                    console.error('[Peppol sync] Failed to save:', result.error);
                }
            }

            // Increment the received counter by the number of ACTUALLY NEW docs imported
            if (imported > 0) {
                fetch('/api/peppol/inbox/count', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: imported }),
                }).catch(() => {}); // fire-and-forget — don't block UI
            }

            setSyncResult({ count: imported });
        } catch (err: any) {
            setSyncResult({ count: 0, error: err.message || t('nav.pages.peppolSyncError') });
        } finally {
            setSyncing(false);
        }
    }, [addConfirmedPage, expensesDbId, t]);

    const handleNewManual = useCallback(async () => {
        if (isCreatingNew) return;
        setIsCreatingNew(true);
        try {
            const result = await createPageServerFirst(expensesDbId, {
                source: 'src-manual',
                status: 'opt-draft',
                invoiceDate: new Date().toISOString().split('T')[0],
                supplier: [],
            });
            if (result.success) {
                addConfirmedPage(result.page);
                setSelectedInvoiceId(result.page.id);
            }
        } catch (e) {
            console.error('[handleNewManual] failed:', e);
        } finally {
            setIsCreatingNew(false);
        }
    }, [isCreatingNew, addConfirmedPage, expensesDbId]);

    const isPeppolReady = peppolStatus.connected && peppolStatus.peppolRegistered;

    return (
        <div className="flex flex-col w-full h-full">
            <ModuleTabs tabs={getFilteredFinancialTabs(planType)} groupId="financials" />

            {/* Peppol received quota banner — shown between tabs and action bar */}
            {quotaWarning?.overQuota && (
                <PeppolQuotaBanner
                    type="received"
                    current={quotaWarning.current}
                    limit={quotaWarning.limit!}
                    plan={quotaWarning.plan}
                />
            )}
            <div className="w-full flex-1 flex flex-col min-h-0">
                {/* Action bar */}
                <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSyncPeppol}
                            disabled={syncing || !isPeppolReady}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {t('nav.pages.syncPeppolInbox')}
                        </button>
                        <button
                            onClick={() => setShowScanUpload(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 border border-orange-200 dark:border-orange-800/30 text-orange-700 dark:text-orange-300 text-xs font-bold rounded-lg transition-colors"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            {t('nav.pages.scanUpload')}
                        </button>
                        <button
                            onClick={handleNewManual}
                            disabled={isCreatingNew}
                            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                        >
                            {isCreatingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {isCreatingNew ? t('nav.pages.creating') : t('nav.pages.manualInvoice')}
                        </button>
                    </div>

                    {/* Peppol status + Sync result */}
                    <div className="flex items-center gap-3">
                        {/* Sync result badge */}
                        {syncResult && (
                            <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
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
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg">
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
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {t('nav.pages.peppolNotConfigured')}
                                </Link>
                            )
                        )}
                    </div>
                </div>

                {/* Database grid */}
                <div className="flex-1 min-h-0">
                    <DatabaseCloneDynamic databaseId="db-expenses" />
                </div>
            </div>

            {/* Purchase Invoice Engine modal */}
            {selectedInvoiceId && (
                <PurchaseInvoiceEngine
                    pageId={selectedInvoiceId}
                    onClose={() => setSelectedInvoiceId(null)}
                />
            )}

            {/* Scan / Upload invoice modal (reuses ticket capture flow, saves to db-expenses) */}
            {showScanUpload && (
                <TicketCaptureModal
                    onClose={() => setShowScanUpload(false)}
                    targetDatabaseId="db-expenses"
                />
            )}
        </div>
    );
}
