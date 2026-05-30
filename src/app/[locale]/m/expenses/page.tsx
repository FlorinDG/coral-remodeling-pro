"use client";

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore } from '@/components/admin/database/store';
import { Camera, Wallet, Plus, Calendar, AlertCircle } from 'lucide-react';
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

export default function MobileExpensesPage() {
    const { resolveDbId } = useTenant();
    const getDatabase = useDatabaseStore(s => s.getDatabase);
    const ticketsDbId = resolveDbId('db-tickets');

    const [showCapture, setShowCapture] = useState(false);
    const [scansUsed, setScansUsed] = useState(0);
    const [scanQuota, setScanQuota] = useState(30);

    const db = getDatabase(ticketsDbId);
    const rawPages = db?.pages || FALLBACK_PAGES;

    useEffect(() => {
        // Fetch tenant quota
        fetch('/api/tenant/profile').then(r => r.json()).then(d => {
            if (d?.scanCount !== undefined) setScansUsed(d.scanCount);
            if (d?.scanQuota !== undefined) setScanQuota(d.scanQuota);
        }).catch(() => {});
    }, []);

    // Sort descending by created date
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
                    <h1 className="text-lg font-black tracking-tight">Expenses</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Tickets & Receipts</p>
                </div>
            </div>

            {/* Quota indicator */}
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-800 dark:text-orange-300">OCR Scans</span>
                </div>
                <div className="text-right">
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">{scansUsed} / {scanQuota}</span>
                    <span className="text-[9px] text-orange-500 ml-1">used</span>
                </div>
            </div>

            {/* List */}
            {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <Wallet className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500">No expenses yet</p>
                    <p className="text-xs text-neutral-400 mt-1 max-w-[250px]">
                        Tap the camera icon below to scan a receipt.
                    </p>
                </div>
            ) : (
                <div className="space-y-2 pb-20">
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

            {/* Floating Action Buttons */}
            <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-3">
                <button
                    onClick={() => setShowCapture(true)}
                    className="w-14 h-14 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* Ticket Capture Modal */}
            {showCapture && (
                <TicketCaptureModal onClose={() => setShowCapture(false)} />
            )}
        </div>
    );
}
