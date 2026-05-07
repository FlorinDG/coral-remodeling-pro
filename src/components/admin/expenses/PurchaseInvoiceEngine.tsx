"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, Check, XCircle, FileText, Loader2, ExternalLink, ArrowDownToLine } from 'lucide-react';
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
    'opt-received': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
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
    'src-peppol': { label: 'Peppol', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' },
    'src-manual': { label: 'Manual', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
    'src-pdf': { label: 'PDF Import', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300' },
};

export default function PurchaseInvoiceEngine({ pageId, onClose }: PurchaseInvoiceEngineProps) {
    const { resolveDbId } = useTenant();
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

    // Editable fields for manual/draft invoices
    const [editData, setEditData] = useState({
        title: '',
        betreft: '',
        invoiceDate: '',
        dueDate: '',
        totalExVat: '',
        totalVat: '',
        totalIncVat: '',
    });

    useEffect(() => {
        if (page) {
            setEditData({
                title: String(page.properties.title || ''),
                betreft: String(page.properties.betreft || ''),
                invoiceDate: String(page.properties.invoiceDate || ''),
                dueDate: String(page.properties.dueDate || ''),
                totalExVat: page.properties.totalExVat ? String(page.properties.totalExVat) : '',
                totalVat: page.properties.totalVat ? String(page.properties.totalVat) : '',
                totalIncVat: page.properties.totalIncVat ? String(page.properties.totalIncVat) : '',
            });

            // If this is a Peppol doc, fetch details
            if (page.properties.source === 'src-peppol' && page.properties.peppolDocId) {
                fetchPeppolDetail(String(page.properties.peppolDocId));
            }
        }
    }, [page]);

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

    const handleSaveEdit = () => {
        if (!page) return;
        Object.entries(editData).forEach(([key, value]) => {
            const numericFields = ['totalExVat', 'totalVat', 'totalIncVat'];
            const finalVal = numericFields.includes(key) && value ? parseFloat(value) : value;
            updatePageProperty(expensesDbId, pageId, key, finalVal);
        });
        setIsEditing(false);
    };

    const handleMarkPaid = () => {
        updatePageProperty(expensesDbId, pageId, 'status', 'opt-paid');
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
        setExportingPdf(true);
        try {
            const supplierName = resolvedSupplier
                ? String(resolvedSupplier.properties.title || '')
                : (peppolDetail?.supplierName || '');

            const lines = peppolDetail?.lines || [];

            await downloadPurchaseInvoicePDF({
                buyerName: 'Coral Remodeling',
                buyerVat: '',
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
            });
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
                    <button onClick={onClose} className="mt-4 text-sm text-blue-500 hover:underline">Close</button>
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
            <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
                    {/* Peppol loading */}
                    {loadingPeppol && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            <span className="ml-2 text-sm text-neutral-500">Loading Peppol document...</span>
                        </div>
                    )}

                    {/* Invoice details (view/edit mode) */}
                    <div className="grid grid-cols-2 gap-4">
                        <InfoField
                            label="Invoice #"
                            value={isEditing ? editData.title : String(page.properties.title || '-')}
                            editable={isEditing}
                            onChange={v => setEditData(p => ({ ...p, title: v }))}
                        />
                        <InfoField
                            label="Description"
                            value={isEditing ? editData.betreft : String(page.properties.betreft || '-')}
                            editable={isEditing}
                            onChange={v => setEditData(p => ({ ...p, betreft: v }))}
                        />
                        <InfoField
                            label="Invoice Date"
                            value={isEditing ? editData.invoiceDate : String(page.properties.invoiceDate || '-')}
                            editable={isEditing}
                            type="date"
                            onChange={v => setEditData(p => ({ ...p, invoiceDate: v }))}
                        />
                        <InfoField
                            label="Due Date"
                            value={isEditing ? editData.dueDate : String(page.properties.dueDate || '-')}
                            editable={isEditing}
                            type="date"
                            onChange={v => setEditData(p => ({ ...p, dueDate: v }))}
                        />
                    </div>

                    {/* Financial summary */}
                    <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
                        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.03] border-b border-neutral-200 dark:border-white/10">
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Financial Summary</h3>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-neutral-200 dark:divide-white/10">
                            <FinancialCell
                                label="Excl. VAT"
                                value={isEditing ? editData.totalExVat : page.properties.totalExVat}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, totalExVat: v }))}
                            />
                            <FinancialCell
                                label="VAT"
                                value={isEditing ? editData.totalVat : page.properties.totalVat}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, totalVat: v }))}
                            />
                            <FinancialCell
                                label="Incl. VAT"
                                value={isEditing ? editData.totalIncVat : page.properties.totalIncVat}
                                editable={isEditing}
                                onChange={v => setEditData(p => ({ ...p, totalIncVat: v }))}
                                highlight
                            />
                        </div>
                    </div>

                    {/* Peppol line items (from UBL) */}
                    {peppolDetail && peppolDetail.lines.length > 0 && (
                        <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
                            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-b border-neutral-200 dark:border-white/10">
                                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    Line Items (from UBL)
                                </h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-white/10 text-xs text-neutral-500 uppercase tracking-wider">
                                        <th className="text-left px-4 py-2">Description</th>
                                        <th className="text-right px-3 py-2">Qty</th>
                                        <th className="text-right px-3 py-2">Unit Price</th>
                                        <th className="text-right px-3 py-2">VAT %</th>
                                        <th className="text-right px-4 py-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {peppolDetail.lines.map((line, i) => (
                                        <tr key={i} className="border-b border-neutral-100 dark:border-white/5 last:border-b-0">
                                            <td className="px-4 py-2.5 text-neutral-900 dark:text-white">{line.description || '-'}</td>
                                            <td className="px-3 py-2.5 text-right text-neutral-600 dark:text-neutral-400">{line.quantity}</td>
                                            <td className="px-3 py-2.5 text-right text-neutral-600 dark:text-neutral-400">€{line.unitPrice.toFixed(2)}</td>
                                            <td className="px-3 py-2.5 text-right text-neutral-600 dark:text-neutral-400">{line.vatRate}%</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-white">€{line.lineTotal.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Peppol supplier info */}
                    {peppolDetail && (
                        <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/50 dark:border-blue-800/30 p-4 space-y-2">
                            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Supplier (from Peppol)</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-neutral-500">Name:</span> <span className="text-neutral-900 dark:text-white font-medium">{peppolDetail.supplierName}</span></div>
                                <div><span className="text-neutral-500">VAT:</span> <span className="text-neutral-900 dark:text-white font-medium">{peppolDetail.supplierVat}</span></div>
                                <div className="col-span-2"><span className="text-neutral-500">Address:</span> <span className="text-neutral-900 dark:text-white font-medium">{peppolDetail.supplierAddress}</span></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        {/* Peppol accept/reject */}
                        {isPeppol && status === 'opt-received' && (
                            <>
                                <button
                                    onClick={() => handlePeppolAction('accept')}
                                    disabled={!!peppolAction}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {peppolAction === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Accept
                                </button>
                                <button
                                    onClick={() => handlePeppolAction('reject')}
                                    disabled={!!peppolAction}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {peppolAction === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                    Reject
                                </button>
                            </>
                        )}

                        {/* Mark as paid */}
                        {status === 'opt-unpaid' && (
                            <button
                                onClick={handleMarkPaid}
                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                <Check className="w-3.5 h-3.5" /> Mark Paid
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Edit / Save toggle */}
                        {!isPeppol && (
                            isEditing ? (
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors"
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
                            )
                        )}

                        {/* Export PDF */}
                        <button
                            onClick={handleExportPDF}
                            disabled={exportingPdf}
                            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            title="Export PDF"
                        >
                            {exportingPdf
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <ArrowDownToLine className="w-3.5 h-3.5" />
                            }
                            PDF
                        </button>
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
    value: any;
    editable?: boolean;
    highlight?: boolean;
    onChange?: (v: string) => void;
}) {
    const formatted = value && !isNaN(parseFloat(value))
        ? `€${parseFloat(value).toFixed(2)}`
        : '-';

    return (
        <div className={`px-4 py-3 ${highlight ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
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
                <p className={`text-lg font-bold ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-900 dark:text-white'}`}>
                    {formatted}
                </p>
            )}
        </div>
    );
}
