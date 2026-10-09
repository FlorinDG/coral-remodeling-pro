"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from "@/i18n/routing";
import { useTenant } from '@/context/TenantContext';
import { useDatabaseStore, usePagesOf } from '@/components/admin/database/store';
import { createPrismaInvoice } from '@/app/actions/create-invoice';
import { getNextDocumentNumber } from '@/app/actions/next-document-number';
import { createPageServerFirst } from '@/app/actions/pages';
import CreateClientModal from '@/components/admin/invoices/CreateClientModal';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link } from '@/i18n/routing';
import { Page, Block } from '@/components/admin/database/types';
import { calculateInvoiceTotals } from '@/lib/invoice-totals';
import { zonedParts, addDaysYmd } from '@/lib/kernel/shift-time';
import { newDocumentLine } from '@/lib/records/document-lines';
import { DEFAULT_VAT_REGIME, documentRateOf } from '@/lib/records/vat-regime';

/** The quick invoice is at the default regime; a line's rate chosen on the phone is its own (mixed rates). */
const DOCUMENT_REGIME = DEFAULT_VAT_REGIME;
import DecimalInput from '@/components/ui/DecimalInput';

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
}


export default function MobileCreateInvoicePage() {
    const t = useTranslations('Mobile');
    const router = useRouter();
    const { resolveDbId, tenant } = useTenant();
    const addConfirmedPage = useDatabaseStore(s => s.addConfirmedPage);
    const createPage = useDatabaseStore(s => s.createPage);

    const invoicesDbId = resolveDbId('db-invoices');
    const clientsDbId = resolveDbId('db-clients');

    // MOBILE-REACT-1 (Florin 2026-10-08: a saved receipt "did not show in the ui"): `getDatabase` was selected as a FUNCTION
    // and called in render — the screen never subscribed to the data. usePagesOf subscribes AND asks for the pages.
    const { pages: clientPages } = usePagesOf(clientsDbId);
    const clientOptions = clientPages.map(p => ({
        value: p.id,
        label: String((p.properties as Record<string, unknown>)?.title || 'Unnamed'),
    }));

    const [selectedClientId, setSelectedClientId] = useState('');
    // The business day (Brussels) — never the UTC day
    const [invoiceDate, setInvoiceDate] = useState(() => zonedParts(new Date()).date);
    const [dueDate, setDueDate] = useState(() => addDaysYmd(zonedParts(new Date()).date, 30));
    const [lines, setLines] = useState<LineItem[]>([
        { id: '1', description: '', quantity: 1, unitPrice: 0, vatRate: documentRateOf(DOCUMENT_REGIME) },
    ]);
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const addLine = () => {
        setLines(prev => [...prev, {
            id: String(Date.now()),
            description: '',
            quantity: 1,
            unitPrice: 0,
            vatRate: documentRateOf(DOCUMENT_REGIME),
        }]);
    };

    const removeLine = (id: string) => {
        if (lines.length <= 1) return;
        setLines(prev => prev.filter(l => l.id !== id));
    };

    const updateLine = (id: string, key: keyof LineItem, value: string | number) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [key]: value } : l));
    };

    // DOC-LINES-2: the lines as the editor's lines (content / quantity / unitPrice / vatRateOverride on the block — the shape the
    // desktop editor, the PDF and Peppol read), and the totals from the ONE rule. Before, the values sat in
    // block.properties, so the invoice opened on desktop with empty €0 lines.
    const lineBlocks = lines
        .filter(l => l.description.trim())
        .map((l, i) => newDocumentLine({ id: `block-${l.id}-${i}`, content: l.description, quantity: l.quantity, unitPrice: l.unitPrice, rate: l.vatRate }, DOCUMENT_REGIME));
    const totals = calculateInvoiceTotals(lineBlocks, { vatRegime: DOCUMENT_REGIME });
    const subtotal = totals.subtotal;
    const totalVat = totals.totalVAT;
    const totalIncVat = totals.totalInclVAT;

    const selectedClientName = clientOptions.find(c => c.value === selectedClientId)?.label || '';

    const handleCreate = useCallback(async () => {
        if (isCreating) return;
        if (!selectedClientId) {
            toast.error('Please select a client');
            return;
        }
        if (lineBlocks.length === 0) {
            toast.error('Please add at least one line item');
            return;
        }

        setIsCreating(true);
        try {
            const result = await getNextDocumentNumber('invoice');
            if (!result.success || !result.number) {
                console.error('[MobileCreateInvoice] getNextDocumentNumber failed:', result.error);
                toast.error(`Factuur nummer kon niet worden aangemaakt: ${result.error || 'onbekende fout'}.`);
                setIsCreating(false);
                return;
            }
            const invoiceNumber = result.number;

            const pageResult = await createPageServerFirst(invoicesDbId, {
                title: invoiceNumber,
                docType: 'opt-invoice',
                status: 'opt-draft',
                client: [selectedClientId],
                clientName: selectedClientName,
                invoiceDate,
                dueDate,
                vatRegime: DOCUMENT_REGIME,
                totalExVat: subtotal,
                totalVat: totalVat,
                totalIncVat: totalIncVat,
            });

            if (!pageResult.success) {
                toast.error('Failed to create invoice');
                setIsCreating(false);
                return;
            }

            addConfirmedPage(pageResult.page);
            await createPrismaInvoice(pageResult.page.id, invoiceNumber);

            if (lineBlocks.length > 0) {
                const updatePageBlocks = useDatabaseStore.getState().updatePageBlocks;
                updatePageBlocks(invoicesDbId, pageResult.page.id, lineBlocks as Block[]);
            }

            toast.success('Invoice created!');
            router.push(`/m/invoices/${pageResult.page.id}`);
        } catch (e) {
            console.error('Failed to create invoice:', e);
            toast.error('Something went wrong');
        }
        setIsCreating(false);
    }, [isCreating, selectedClientId, selectedClientName, invoiceDate, dueDate, lineBlocks, subtotal, totalVat, totalIncVat, invoicesDbId, addConfirmedPage, router, tenant, setIsCreating]);

    const handleClientCreated = (pageId: string) => {
        setSelectedClientId(pageId);
        setShowNewClientModal(false);
    };

    return (
        <div className="max-w-lg mx-auto pb-6">
            {/* Header */}
            <div className="sticky top-14 z-30 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-neutral-200/50 dark:border-white/5 px-4 py-3 flex items-center justify-between">
                <Link href="/m/invoices" className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700">
                    <ArrowLeft className="w-4 h-4" />
                    {t('inv_form_back')}
                </Link>
                <h1 className="text-sm font-black">{t('inv_form_new')}</h1>
                <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-bold disabled:opacity-50 active:scale-[0.97] transition-all"
                    style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
                >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {t('inv_form_create')}
                </button>
            </div>

            <div className="px-4 pt-4 space-y-5">
                {/* ── Client Selection ── */}
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t('inv_form_client')}</label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <SearchableSelect
                                options={clientOptions}
                                value={selectedClientId}
                                onChange={setSelectedClientId}
                                placeholder={t('inv_form_search_client')}
                            />
                        </div>
                        <button
                            onClick={() => setShowNewClientModal(true)}
                            className="shrink-0 px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Dates ── */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t('inv_form_date')}</label>
                        <input
                            type="date"
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t('inv_form_due')}</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                        />
                    </div>
                </div>

                {/* ── Line Items ── */}
                <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">{t('inv_form_lines')}</label>
                    <div className="space-y-3">
                        {lines.map((line, idx) => (
                            <div key={line.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/5 p-3 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-1">#{idx + 1}</span>
                                    {lines.length > 1 && (
                                        <button onClick={() => removeLine(line.id)} className="p-1 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={line.description}
                                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                                    placeholder={t('inv_form_desc')}
                                    className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[9px] font-semibold text-neutral-400 block mb-0.5">{t('inv_form_qty')}</label>
                                        <DecimalInput
                                            decimals={3}
                                            value={line.quantity}
                                            onValueChange={n => updateLine(line.id, 'quantity', n ?? 0)}
                                            className="w-full px-2 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-semibold text-neutral-400 block mb-0.5">{t('inv_form_unit')}</label>
                                        <DecimalInput
                                            value={line.unitPrice || null}
                                            onValueChange={n => updateLine(line.id, 'unitPrice', n ?? 0)}
                                            placeholder="0,00"
                                            className="w-full px-2 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-semibold text-neutral-400 block mb-0.5">{t('inv_form_vat')}</label>
                                        <select
                                            value={line.vatRate}
                                            onChange={e => updateLine(line.id, 'vatRate', Number(e.target.value))}
                                            className="w-full px-2 py-1.5 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-[var(--brand-color,#d35400)]/30 transition-all"
                                        >
                                            <option value={0}>0%</option>
                                            <option value={6}>6%</option>
                                            <option value={12}>12%</option>
                                            <option value={21}>21%</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="text-right text-xs font-bold text-neutral-600 dark:text-neutral-300">
                                    €{(line.quantity * line.unitPrice).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addLine}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-neutral-300 dark:border-white/15 text-xs font-bold text-neutral-500 hover:border-[var(--brand-color)]/50 hover:text-[var(--brand-color)] transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('inv_form_add_line')}
                    </button>
                </div>

                {/* ── Totals ── */}
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-white/5 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">{t('inv_form_subtotal')}</span>
                        <span className="font-bold">€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">{t('inv_form_vat_total')}</span>
                        <span className="font-bold">€{totalVat.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-neutral-100 dark:bg-white/5" />
                    <div className="flex justify-between text-base">
                        <span className="font-bold">{t('inv_form_total')}</span>
                        <span className="font-black" style={{ color: 'var(--brand-color, #d35400)' }}>
                            €{totalIncVat.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Create Client Modal */}
            <CreateClientModal
                isOpen={showNewClientModal}
                onClose={() => setShowNewClientModal(false)}
                onCreated={handleClientCreated}
                createPage={createPage}
                clientsDbId={clientsDbId}
            />
        </div>
    );
}
