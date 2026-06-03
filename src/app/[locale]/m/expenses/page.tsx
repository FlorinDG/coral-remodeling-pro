/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Camera, Wallet, Plus, Calendar, Receipt, Building2, AlertCircle, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { Page } from '@/components/admin/database/types';

// Load modal dynamically so we don't block render
const TicketCaptureModal = dynamic(
    () => import('@/components/admin/expenses/TicketCaptureModal'),
    { ssr: false }
);

const CATEGORY_ICONS: Record<string, string> = {
    'cat-fuel': '⛽',
    'cat-restaurant': '🍽️',
    'cat-office': '📎',
    'cat-tools': '🔧',
    'cat-materials': '🧱',
    'cat-parking': '🅿️',
    'cat-transport': '🚗',
    'cat-other': '📦',
};

const FALLBACK_PAGES: Page[] = [];

type PeppolInvoice = {
    id: string;
    supplier: string;
    amount: number;
    date: string;
    status: string;
    title: string;
};

export default function MobileExpensesPage() {
    const t = useTranslations('Mobile');
    const { resolveDbId } = useTenant();
    const getDatabase = useDatabaseStore(s => s.getDatabase);
    const ticketsDbId = resolveDbId('db-tickets');

    const [activeTab, setActiveTab] = useState<'scans' | 'peppol'>('scans');
    const [showCapture, setShowCapture] = useState(false);
    const [scansUsed, setScansUsed] = useState(0);
    const [scanQuota, setScanQuota] = useState(30);
    const [peppolInvoices, setPeppolInvoices] = useState<PeppolInvoice[]>([]);
    const [peppolLoading, setPeppolLoading] = useState(false);

    const db = getDatabase(ticketsDbId);
    const rawPages = db?.pages || FALLBACK_PAGES;

    useEffect(() => {
        // Fetch tenant quota
        fetch('/api/tenant/profile').then(r => r.json()).then(d => {
            if (d?.scanCount !== undefined) setScansUsed(d.scanCount);
            if (d?.scanQuota !== undefined) setScanQuota(d.scanQuota);
        }).catch(() => {});
    }, []);

    const fetchPeppol = useCallback(async () => {
        if (peppolInvoices.length > 0) return; // already loaded
        setPeppolLoading(true);
        try {
            const res = await fetch('/api/peppol/inbox');
            if (res.ok) {
                const data = await res.json();
                const items: PeppolInvoice[] = (data?.documents ?? []).map((inv: any) => ({
                    id: inv.id ?? Math.random().toString(36),
                    supplier: inv.parsed?.supplierName ?? inv.vendor_name ?? 'Unknown Supplier',
                    amount: Number(inv.parsed?.totalIncVat ?? inv.invoice_total ?? 0),
                    date: inv.parsed?.issueDate ?? inv.invoice_date ?? '',
                    status: inv.parsed ? 'opt-unpaid' : 'opt-draft',
                    title: inv.parsed?.invoiceNumber ?? inv.invoice_id ?? '',
                }));
                setPeppolInvoices(items);
            }
        } catch {
            // silently fail — empty state handles it
        } finally {
            setPeppolLoading(false);
        }
    }, [peppolInvoices.length]);

    useEffect(() => {
        if (activeTab === 'peppol') fetchPeppol();
    }, [activeTab, fetchPeppol]);

    // Sort scans descending by date
    const tickets = [...rawPages].sort((a, b) => {
        const dA = new Date(a.createdAt).getTime();
        const dB = new Date(b.createdAt).getTime();
        return dB - dA;
    }).map(p => {
        const props = p.properties as Record<string, any>;
        return {
            id: p.id,
            merchant: String(props['title'] || 'Unnamed Expense'),
            date: String(props['date'] || new Date(p.createdAt).toISOString().split('T')[0]),
            amount: Number(props['amount'] ?? 0),
            category: String(props['category'] || 'cat-other'),
        };
    });

    return (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4 relative min-h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black tracking-tight">{t('exp_title')}</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{t('exp_subtitle')}</p>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('scans')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'scans'
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    <Camera className="w-3.5 h-3.5" />
                    {t('scans')}
                </button>
                <button
                    onClick={() => setActiveTab('peppol')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'peppol'
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                >
                    <Inbox className="w-3.5 h-3.5" />
                    {t('peppol_inbox')}
                </button>
            </div>

            {/* ─── SCANS TAB ─── */}
            {activeTab === 'scans' && (
                <>
                    {/* Quota indicator */}
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Camera className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-bold text-orange-800 dark:text-orange-300">{t('exp_ocr_scans')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-orange-200 dark:bg-orange-800/40 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-orange-400 transition-all"
                                    style={{ width: `${Math.min(100, (scansUsed / scanQuota) * 100)}%` }}
                                />
                            </div>
                            <span className="text-xs font-black text-orange-600 dark:text-orange-400">{scansUsed}/{scanQuota}</span>
                        </div>
                    </div>

                    {/* List */}
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                                <Wallet className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-500">{t('exp_empty_title')}</p>
                            <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">
                                {t('exp_empty_desc')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-24">
                            {tickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-white/5 flex items-center justify-center text-lg border border-neutral-100 dark:border-white/5">
                                            {CATEGORY_ICONS[ticket.category] || '📦'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold leading-tight">{ticket.merchant}</p>
                                            <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" />
                                                {ticket.date}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-neutral-800 dark:text-neutral-200">
                                        €{ticket.amount.toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* FAB */}
                    <div className="fixed bottom-20 right-4 z-40">
                        <button
                            onClick={() => setShowCapture(true)}
                            className="w-14 h-14 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>
                </>
            )}

            {/* ─── PEPPOL INBOX TAB ─── */}
            {activeTab === 'peppol' && (
                <>
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-3.5 flex items-start gap-3">
                        <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t('pur_peppol_active')}</p>
                    </div>

                    {peppolLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-8 h-8 border-2 border-neutral-200 dark:border-white/10 border-t-neutral-600 dark:border-t-white/40 rounded-full animate-spin" />
                        </div>
                    ) : peppolInvoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                                <Inbox className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-500">{t('pur_empty_title')}</p>
                            <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">{t('pur_empty_desc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-20">
                            {peppolInvoices.map(inv => {
                                const isUnpaid = inv.status !== 'opt-paid';
                                return (
                                    <div
                                        key={inv.id}
                                        className="p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-start gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Building2 className="w-4 h-4 text-neutral-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold leading-tight">{inv.supplier}</p>
                                                    {inv.date && (
                                                        <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                                                            <Calendar className="w-3 h-3" />{inv.date}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm font-black text-neutral-800 dark:text-neutral-200">
                                                €{inv.amount.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-dashed border-neutral-100 dark:border-white/5 pt-2">
                                            <p className="text-[9px] text-neutral-400 truncate max-w-[150px]">{inv.title}</p>
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${
                                                isUnpaid ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                                            }`}>
                                                {isUnpaid && <AlertCircle className="w-3 h-3" />}
                                                {isUnpaid ? t('pur_to_pay') : t('pur_paid')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Ticket Capture Modal */}
            {showCapture && (
                <TicketCaptureModal onClose={() => setShowCapture(false)} />
            )}
        </div>
    );
}
