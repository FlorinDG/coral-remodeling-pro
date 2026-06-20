/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, Check, XCircle, FileText, Loader2, ExternalLink, ArrowDownToLine, Camera, CheckCircle2 } from 'lucide-react';
import { useDatabaseStore } from '@/components/admin/database/store';
import type { Page } from '@/components/admin/database/types';
import { downloadPurchaseInvoicePDF } from '@/components/admin/expenses/PurchaseInvoicePDF';
import { useTenant } from '@/context/TenantContext';

interface PurchaseInvoiceEngineProps {
    pageId: string;
    onClose: () => void;
}

interface InvoiceLine {
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
}

interface ParsedInvoice {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    supplierName: string;
    supplierVat: string;
    supplierAddress: string;
    currency: string;
    lines: InvoiceLine[];
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
    peppolDocId: string;
}

const STATUS_COLORS: Record<string, string> = {
    'opt-draft': 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    'opt-received': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'opt-unpaid': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'opt-paid': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'opt-overdue': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    'opt-disputed': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const STATUS_LABELS: Record<string, string> = {
    'opt-draft': 'Draft',
    'opt-received': 'Received',
    'opt-unpaid': 'Unpaid',
    'opt-paid': 'Paid',
    'opt-overdue': 'Overdue',
    'opt-disputed': 'Disputed',
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
    'src-peppol': { label: 'Peppol', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300' },
    'src-manual': { label: 'Manual', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
    'src-pdf': { label: 'PDF Import', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300' },
};
// Format ISO date to Belgian dd/MM/yyyy
function formatDateBE(isoDate: string | undefined | null): string {
    if (!isoDate) return '—';
    try {
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return String(isoDate);
        return new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    } catch {
        return String(isoDate);
    }
}

function calculateHeaderTotalsFromLines(lines: any[]) {
    const totalExVat = lines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
    const totalVat = lines.reduce((sum, line) => sum + ((line.lineTotal || 0) * ((line.vatRate ?? 21) / 100)), 0);
    const totalIncVat = totalExVat + totalVat;
    return {
        totalExVat: String(Math.round(totalExVat * 100) / 100),
        totalVat: String(Math.round(totalVat * 100) / 100),
        totalIncVat: String(Math.round(totalIncVat * 100) / 100),
    };
}

export default function PurchaseInvoiceEngine({ pageId, onClose }: PurchaseInvoiceEngineProps) {
    const { activeModules, resolveDbId, tenant } = useTenant();
    const expensesDbId = resolveDbId('db-expenses');
    const suppliersDbId = resolveDbId('db-suppliers');

    const page = useDatabaseStore(s => {
        const db = s.getDatabase(expensesDbId);
        return db?.pages.find((p: Page) => p.id === pageId);
    });
    const updatePageProperty = useDatabaseStore(s => s.updatePageProperty);
    const suppliersDb = useDatabaseStore(s => s.getDatabase(suppliersDbId));

    const [peppolDetail, setPeppolDetail] = useState<ParsedInvoice | null>(null);
    const [loadingPeppol, setLoadingPeppol] = useState(false);
    const [peppolAction, setPeppolAction] = useState<'accept' | 'reject' | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    // Approve/Reject workflow (universal — not just Peppol)
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [approveLoading, setApproveLoading] = useState(false);


    // Editable fields for manual/draft invoices
    const [editData, setEditData] = useState({
        title: '',
        supplierName: '',
        supplierVat: '',
        betreft: '',
        ogm: '',
        contact: '',
        invoiceDate: '',
        dueDate: '',
        totalExVat: '',
        totalVat: '',
        totalIncVat: '',
        lines: [] as any[],
    });

    useEffect(() => {
        if (page) {
            let lines = page.blocks?.filter((b: any) => b.type === 'financial-row').map((b: any) => ({
                id: b.id,
                description: String(b.content || ''),
                quantity: Number(b.properties?.quantity || 0),
                unitCode: String(b.properties?.unitCode || 'C62'),
                unitPrice: Number(b.properties?.unitPrice || 0),
                vatRate: Number(b.properties?.vatRate || 0),
                lineTotal: Number(b.properties?.lineTotal || 0)
            })) || [];

            if (lines.length === 0 && peppolDetail?.lines) {
                lines = peppolDetail.lines.map((l: any, i: number) => ({
                    id: `temp-${i}`,
                    description: l.description || l.name || '',
                    quantity: l.quantity || 0,
                    unitCode: l.unitCode || 'C62',
                    unitPrice: l.unitPrice || l.price || 0,
                    vatRate: l.vatRate || 0,
                    lineTotal: l.lineTotal || l.totalExVat || 0
                }));
            }

            let totalExVat = page.properties.totalExVat ? String(page.properties.totalExVat) : '';
            let totalVat = page.properties.totalVat ? String(page.properties.totalVat) : '';
            let totalIncVat = page.properties.totalIncVat ? String(page.properties.totalIncVat) : '';

            if (lines.length > 0) {
                const computed = calculateHeaderTotalsFromLines(lines);
                totalExVat = computed.totalExVat;
                totalVat = computed.totalVat;
                totalIncVat = computed.totalIncVat;
            }

            setEditData({
                title: String(page.properties.title || ''),
                supplierName: String(page.properties.supplierName || ''),
                supplierVat: String(page.properties.supplierVat || ''),
                betreft: String(page.properties.betreft || ''),
                ogm: String(page.properties.ogm || ''),
                contact: String(page.properties.contact || ''),
                invoiceDate: String(page.properties.invoiceDate || ''),
                dueDate: String(page.properties.dueDate || ''),
                totalExVat,
                totalVat,
                totalIncVat,
                lines,
            });

            // If this is a Peppol doc, fetch details
            if (page.properties.source === 'src-peppol' && page.properties.peppolDocId && !peppolDetail && !loadingPeppol) {
                fetchPeppolDetail(String(page.properties.peppolDocId));
            }
        }
    }, [page, peppolDetail]);

    const fetchPeppolDetail = async (docId: string) => {
        setLoadingPeppol(true);
        try {
            const res = await fetch(`/api/peppol/inbox/${docId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.parsed) setPeppolDetail(data.parsed);
            }
        } catch (err) {
            console.error('Failed to fetch Peppol detail:', err);
        }
        setLoadingPeppol(false);
    };

    const handlePeppolAction = async (action: 'accept' | 'reject') => {
        if (!page?.properties.peppolDocId) return;
        setPeppolAction(action);
        try {
            const res = await fetch('/api/peppol/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId: page.properties.peppolDocId, action }),
            });
            if (res.ok) {
                updatePageProperty(expensesDbId, pageId, 'status', action === 'accept' ? 'opt-unpaid' : 'opt-disputed');
            }
        } catch (err) {
            console.error('Peppol action failed:', err);
        }
        setPeppolAction(null);
    };

    const updatePageBlocks = useDatabaseStore(s => s.updatePageBlocks);

    const handleSaveEdit = () => {
        if (!page) return;
        Object.entries(editData).forEach(([key, value]) => {
            if (key === 'lines') return;
            const numericFields = ['totalExVat', 'totalVat', 'totalIncVat'];
            const finalVal = numericFields.includes(key) && value ? parseFloat(value as string) : value;
            updatePageProperty(expensesDbId, pageId, key, finalVal);
        });

        const newBlocks = editData.lines.map((line: any) => ({
            id: line.id && !line.id.startsWith('temp-') ? line.id : `line-${Date.now()}-${Math.random().toString(36).substring(2)}`,
            type: 'financial-row',
            content: line.description,
            properties: {
                quantity: parseFloat(String(line.quantity)) || 0,
                unitCode: line.unitCode || 'C62',
                unitPrice: parseFloat(String(line.unitPrice)) || 0,
                vatRate: parseFloat(String(line.vatRate)) || 0,
                lineTotal: parseFloat(String(line.lineTotal)) || 0
            }
        }));

        const oldBlocks = page.blocks || [];
        const nonFinancialBlocks = oldBlocks.filter((b: any) => b.type !== 'financial-row');
        updatePageBlocks(expensesDbId, pageId, [...nonFinancialBlocks, ...newBlocks]);

        setIsEditing(false);
    };

    const handleMarkPaid = () => {
        updatePageProperty(expensesDbId, pageId, 'status', 'opt-paid');
    };

    // Universal approve / reject (works for all invoice sources)
    const handleApprove = async () => {
        setApproveLoading(true);
        const isPeppolInvoice = page?.properties.source === 'src-peppol';
        if (isPeppolInvoice && page?.properties.peppolDocId) {
            await handlePeppolAction('accept');
        } else {
            updatePageProperty(expensesDbId, pageId, 'status', 'opt-unpaid');
        }
        setApproveLoading(false);
    };

    const handleRejectConfirm = async () => {
        setApproveLoading(true);
        const isPeppolInvoice = page?.properties.source === 'src-peppol';
        if (isPeppolInvoice && page?.properties.peppolDocId) {
            await handlePeppolAction('reject');
        } else {
            updatePageProperty(expensesDbId, pageId, 'status', 'opt-disputed');
        }
        if (rejectComment.trim()) {
            updatePageProperty(expensesDbId, pageId, 'rejectionNote', rejectComment.trim());
        }
        setRejectMode(false);
        setRejectComment('');
        setApproveLoading(false);
    };

    const resolvedSupplier = (() => {
        if (!suppliersDb || !page) return null;
        const relVal = page.properties.supplier;
        if (Array.isArray(relVal) && relVal.length > 0) {
            return suppliersDb.pages.find((p: Page) => p.id === relVal[0]);
        }
        return null;
    })();

    const handleExportPDF = async () => {
        if (!page) return;

        if (page.properties.receiptUrl && typeof page.properties.receiptUrl === 'string') {
            const receiptUrl = page.properties.receiptUrl;
            const u = receiptUrl.startsWith('http') ? receiptUrl : `/api/files/${receiptUrl}`;
            window.open(u, '_blank');
            return;
        }

        setExportingPdf(true);
        try {
            const supplierName = resolvedSupplier
                ? String(resolvedSupplier.properties.title || '')
                : (peppolDetail?.supplierName || '');

            const lines = peppolDetail?.lines || [];

            const buyerAddress = [
                tenant?.street,
                [tenant?.postalCode, tenant?.city].filter(Boolean).join(' '),
                tenant?.country
            ].filter(Boolean).join(', ');

            await downloadPurchaseInvoicePDF({
                buyerName: tenant?.commercialName || tenant?.companyName || 'Coral Remodeling',
                buyerVat: tenant?.vatNumber || '',
                buyerAddress: buyerAddress || '',
                supplierName,
                supplierVat: peppolDetail?.supplierVat || '',
                supplierAddress: peppolDetail?.supplierAddress || '',
                invoiceNumber: String(page.properties.title || 'N/A'),
                invoiceDate: String(page.properties.invoiceDate || ''),
                dueDate: String(page.properties.dueDate || ''),
                currency: '€',
                source: SOURCE_BADGES[page.properties.source as string]?.label,
                lines,
                totalExVat: parseFloat(String(page.properties.totalExVat || 0)),
                totalVat: parseFloat(String(page.properties.totalVat || 0)),
                totalIncVat: parseFloat(String(page.properties.totalIncVat || 0)),
            }, tenant?.brandColor);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setExportingPdf(false);
        }
    };

    if (!page) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center">
                    <p className="text-neutral-500">Invoice not found</p>
                    <button onClick={onClose} className="mt-4 text-sm text-orange-500 hover:underline">Close</button>
                </div>
            </div>
        );
    }

    const source = page.properties.source as string || 'src-manual';
    const status = page.properties.status as string || 'opt-draft';
    const isPeppol = source === 'src-peppol';
    const sourceBadge = SOURCE_BADGES[source] || SOURCE_BADGES['src-manual'];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="relative w-full max-w-7xl h-[90vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Left Pane (Metadata & Lines) */}
                <div className="w-[55%] flex flex-col border-r border-neutral-200 dark:border-white/10 relative bg-white dark:bg-neutral-900">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                                        {page.properties.title || 'Untitled Invoice'}
                                    </h2>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${sourceBadge.color}`}>
                                        {sourceBadge.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS['opt-draft']}`}>
                                        {STATUS_LABELS[status] || status}
                                    </span>
                                    {resolvedSupplier && (
                                        <span className="text-xs text-neutral-500">• {String(resolvedSupplier.properties.title)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0 xl:hidden block">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Left Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {loadingPeppol && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                                <span className="ml-2 text-sm text-neutral-500">Loading Peppol document...</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <InfoField
                                label="Supplier"
                                value={isEditing ? String(editData.supplierName || '') : (resolvedSupplier ? String(resolvedSupplier.properties.title || '') : String(page.properties.supplierName || '') || '—')}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, supplierName: v }))}
                            />
                            <InfoField
                                label="Supplier VAT"
                                value={isEditing ? String(editData.supplierVat || '') : (resolvedSupplier ? String(resolvedSupplier.properties.vatNumber || '') : String(page.properties.supplierVat || peppolDetail?.supplierVat || ''))}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, supplierVat: v }))}
                            />
                            <InfoField
                                label="Contact"
                                value={isEditing ? String(editData.contact || '') : String(page.properties.contact || '') || '—'}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, contact: v }))}
                            />
                            <InfoField
                                label="OGM / Gestructureerde mededeling"
                                value={isEditing ? String(editData.ogm || '') : String(page.properties.ogm || '') || '—'}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, ogm: v }))}
                            />
                            <InfoField
                                label="Object / Betreft"
                                value={isEditing ? String(editData.betreft || '') : String(page.properties.betreft || '') || '—'}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, betreft: v }))}
                            />
                            <InfoField
                                label="Invoice Date"
                                value={isEditing ? String(editData.invoiceDate || '') : formatDateBE(String(page.properties.invoiceDate || ''))}
                                editable={isEditing}
                                type="date"
                                onChange={v => setEditData(p => ({ ...p, invoiceDate: v }))}
                            />
                            <InfoField
                                label="Due Date"
                                value={isEditing ? String(editData.dueDate || '') : formatDateBE(String(page.properties.dueDate || ''))}
                                editable={isEditing}
                                type="date"
                                onChange={v => setEditData(p => ({ ...p, dueDate: v }))}
                            />
                        </div>

                        {/* Financial summary */}
                        <div className="grid grid-cols-3 divide-x divide-neutral-200 dark:divide-white/10 border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden bg-neutral-50/50 dark:bg-black/10">
                            <FinancialCell
                                label="Total Excl. VAT"
                                value={(isEditing ? editData.totalExVat : page.properties.totalExVat) as string | number}
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalExVat: v }))}
                            />
                            <FinancialCell
                                label="Total VAT"
                                value={(isEditing ? editData.totalVat : page.properties.totalVat) as string | number}
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalVat: v }))}
                            />
                            <FinancialCell
                                label="Total Incl. VAT"
                                value={(isEditing ? editData.totalIncVat : page.properties.totalIncVat) as string | number}
                                highlight
                                editable={isEditing && editData.lines.length === 0}
                                onChange={v => setEditData(p => ({ ...p, totalIncVat: v }))}
                            />
                        </div>

                        {/* Structured line items */}
                        {(isEditing || (page.blocks && page.blocks.filter((b: any) => b.type === 'financial-row').length > 0)) && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Line Items</h3>
                                    {isEditing && (
                                        <button onClick={() => setEditData(p => {
                                            const newLines = [...p.lines, { id: `temp-${Date.now()}`, description: '', quantity: 1, unitCode: 'C62', unitPrice: 0, vatRate: 21, lineTotal: 0 }];
                                            const computed = calculateHeaderTotalsFromLines(newLines);
                                            return { ...p, lines: newLines, ...computed };
                                        })} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                                            + Add Line
                                        </button>
                                    )}
                                </div>
                                <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Description</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-16">Qty</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-24">Price</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-20">VAT%</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right w-24">Total</th>
                                                {isEditing && <th className="px-3 py-2 w-8"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                            {(isEditing ? editData.lines : page.blocks.filter((b: any) => b.type === 'financial-row').map((b: any) => ({
                                                id: b.id, description: b.content, quantity: b.properties?.quantity, unitCode: b.properties?.unitCode, unitPrice: b.properties?.unitPrice, vatRate: b.properties?.vatRate, lineTotal: b.properties?.lineTotal
                                            }))).map((line: any, i: number) => (
                                                <tr key={line.id || i} className="bg-white dark:bg-transparent">
                                                    <td className="px-3 py-2">
                                                        {isEditing ? (
                                                            <input type="text" value={line.description} onChange={e => { const l = [...editData.lines]; l[i].description = e.target.value; setEditData({ ...editData, lines: l }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                        ) : (
                                                            <span className="text-neutral-900 dark:text-white font-medium">{line.description}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="1" value={line.quantity} onChange={e => { const l = [...editData.lines]; l[i].quantity = parseFloat(e.target.value) || 0; l[i].lineTotal = l[i].quantity * l[i].unitPrice; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">{line.quantity || 0}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.unitPrice} onChange={e => { const l = [...editData.lines]; l[i].unitPrice = parseFloat(e.target.value) || 0; l[i].lineTotal = l[i].quantity * l[i].unitPrice; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">€{Number(line.unitPrice || 0).toFixed(2)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.vatRate} onChange={e => { const l = [...editData.lines]; l[i].vatRate = parseFloat(e.target.value) || 0; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right" />
                                                        ) : (
                                                            <span className="text-neutral-500">{line.vatRate || 0}%</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {isEditing ? (
                                                            <input type="number" step="0.01" value={line.lineTotal} onChange={e => { const l = [...editData.lines]; l[i].lineTotal = parseFloat(e.target.value) || 0; const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="w-full px-2 py-1 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right font-medium" />
                                                        ) : (
                                                            <span className="text-neutral-900 dark:text-white font-medium">€{Number(line.lineTotal || 0).toFixed(2)}</span>
                                                        )}
                                                    </td>
                                                    {isEditing && (
                                                        <td className="px-2 py-2 text-center">
                                                            <button onClick={() => { const l = editData.lines.filter((_, idx) => idx !== i); const computed = calculateHeaderTotalsFromLines(l); setEditData({ ...editData, lines: l, ...computed }); }} className="text-red-400 hover:text-red-600">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {/* Fallback for legacy peppol detail lines if blocks aren't available */}
                        {(!page.blocks || page.blocks.filter((b: any) => b.type === 'financial-row').length === 0) && peppolDetail && peppolDetail.lines.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Legacy Peppol Line Items</h3>
                                <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400">Description</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right">Qty</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right">Price</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right">VAT%</th>
                                                <th className="px-3 py-2 font-semibold text-neutral-600 dark:text-neutral-400 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                                            {peppolDetail.lines.map((line: any, i: number) => (
                                                <tr key={i} className="bg-white dark:bg-transparent">
                                                    <td className="px-3 py-2 text-neutral-900 dark:text-white font-medium">{line.name}</td>
                                                    <td className="px-3 py-2 text-neutral-500 text-right">{line.quantity}</td>
                                                    <td className="px-3 py-2 text-neutral-500 text-right">€{Number(line.unitPrice ?? line.price).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-neutral-500 text-right">{line.vatRate}%</td>
                                                    <td className="px-3 py-2 text-neutral-900 dark:text-white font-medium text-right">€{Number(line.lineTotal ?? line.totalExVat).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Left Footer Action bar */}
                    <div className="px-6 py-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-black/10">
                        <div className="flex items-center gap-2">
                            {status === 'opt-draft' && (
                                <>
                                    <button
                                        onClick={handleApprove}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => setRejectMode(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Reject
                                    </button>
                                </>
                            )}
                            {status === 'opt-unpaid' && (
                                <button
                                    onClick={handleMarkPaid}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Mark Paid
                                </button>
                            )}
                            {status === 'opt-disputed' && page?.properties.rejectionNote && (
                                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg max-w-xs">
                                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed truncate">{String(page.properties.rejectionNote)}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Save Changes
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={handleExportPDF}
                                disabled={exportingPdf}
                                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                title="Export PDF"
                            >
                                {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
                                PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Pane (Document Viewer) */}
                <div className="w-[45%] flex flex-col bg-neutral-100 dark:bg-neutral-950 relative">
                    <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                        <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Original Document
                        </h3>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0 xl:block hidden">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 p-4 flex flex-col min-h-0">
                        {page.properties.receiptUrl && typeof page.properties.receiptUrl === 'string' ? (
                            <iframe 
                                src={page.properties.receiptUrl.startsWith('http') ? page.properties.receiptUrl : `/api/files/${page.properties.receiptUrl}`} 
                                className="w-full h-full rounded-xl border border-neutral-200 dark:border-white/10 bg-white" 
                                title="Original Document"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full text-neutral-400 bg-white/40 dark:bg-white/5 rounded-xl border border-dashed border-neutral-300 dark:border-white/20">
                                <FileText className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm font-medium">No original document attached</p>
                                <p className="text-xs mt-1 opacity-70">This invoice was either manually created or has no scanned receipt.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ──

function InfoField({ label, value, editable, type, onChange }: {
    label: string;
    value: string;
    editable?: boolean;
    type?: string;
    onChange?: (v: string) => void;
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{label}</label>
            {editable ? (
                <input
                    type={type || 'text'}
                    value={value}
                    onChange={e => onChange?.(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
            ) : (
                <p className="text-sm text-neutral-900 dark:text-white font-medium">{value || '-'}</p>
            )}
        </div>
    );
}

function FinancialCell({ label, value, editable, highlight, onChange }: {
    label: string;
    value: string | number | null | undefined;
    editable?: boolean;
    highlight?: boolean;
    onChange?: (v: string) => void;
}) {
    const formatted = value && !isNaN(parseFloat(String(value)))
        ? `€${parseFloat(String(value)).toFixed(2)}`
        : '-';

    return (
        <div className={`px-4 py-3 ${highlight ? 'bg-orange-50/50 dark:bg-blue-950/10' : ''}`}>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">{label}</p>
            {editable ? (
                <input
                    type="number"
                    step="0.01"
                    value={String(value || '')}
                    onChange={e => onChange?.(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
            ) : (
                <p className={`text-lg font-bold ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-900 dark:text-white'}`}>
                    {formatted}
                </p>
            )}
        </div>
    );
}
