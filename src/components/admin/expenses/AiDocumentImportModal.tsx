"use client";

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Loader2, Sparkles, CheckCircle, FileText, AlertCircle, Inbox, ArrowRight } from 'lucide-react';
import { createPageServerFirst, updatePageServerFirst } from '@/app/actions/pages';
import { useTenant } from '@/context/TenantContext';
import { isTenantDatabase } from '@/lib/relations/resolve';
import { uploadFileAction } from '@/app/actions/files';
import { useDatabaseStore } from '../database/store';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { READABLE_ACCEPT } from '@/lib/records/readable-document';   // SCAN-2: iOS converts HEIC to JPEG itself
import { prepareUpload } from '@/lib/files/prepare-upload';
import { readingSummary, needsValidation } from '@/lib/records/purchase-document';
import { MAX_UPLOAD_BYTES, tooLargeMessage } from '@/lib/files/upload-size';

interface AiDocumentImportModalProps {
    onClose: () => void;
    targetDatabaseId?: string;
    onComplete?: () => void;
}

interface UploadJob {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
    error?: string;
    verdict?: string;
    /** what the reading found — "Brico · 02/10/2026 · € 12,50" — and why it needs a person, if it does */
    summary?: string;
    reason?: string;
    pageId?: string;
}

/**
 * Bulk import — purchase invoices OR tickets (Florin 2026-10-05: "Bulk upload tickets, I asked for it a long time
 * ago"). Per file: a record, the file stored AND linked to it (receiptUrl — before, the upload was never linked:
 * bulk-imported documents had no file and the accountant export missed them), then the AI reading. Whatever the
 * reading cannot settle (duplicate, failed scan, FREE plan PDF) stays in the inbox as "Na te kijken" with its file:
 * a person decides, the import never discards.
 */
export default function AiDocumentImportModal({ onClose, targetDatabaseId = 'db-expenses', onComplete }: AiDocumentImportModalProps) {
    const [kind, setKind] = useState<'db-expenses' | 'db-tickets' | 'db-purchase-quotes'>(
        isTenantDatabase(targetDatabaseId, 'db-tickets') ? 'db-tickets'
            : isTenantDatabase(targetDatabaseId, 'db-purchase-quotes') ? 'db-purchase-quotes' : 'db-expenses');
    const target = kind;
    const isTickets = kind === 'db-tickets';
    /** The record's kind for the shared purchase rules (readingSummary) — QUOTE-IN-1 adds supplier quotes. */
    const role = isTickets ? 'tickets' : kind === 'db-purchase-quotes' ? 'purchase-quotes' : 'expenses';
    const { planType } = useTenant();
    const isFree = (planType || 'FREE') === 'FREE';
    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const locale = useLocale();
    // VALIDATE-1: imports wait in "Te valideren" (the Tickets / Purchase-invoice screens show only what counts) — the
    // right tab, and the document itself when a row is chosen
    // QUOTE-IN-1: a supplier quote is not a cost — it is never validated; it opens in its own list
    const openInValidation = (pageId?: string) => {
        onComplete?.();
        if (!needsValidation(role)) {
            router.push(`/${locale}/admin/financials/expenses/quotes${pageId ? `?open=${pageId}` : ''}`);
        } else {
            const q = new URLSearchParams({ tab: isTickets ? 'tickets' : 'purchase', ...(pageId ? { open: pageId } : {}) });
            router.push(`/${locale}/admin/financials/expenses/to-validate?${q}`);
        }
        onClose();
    };

    const handleFiles = useCallback(async (files: File[]) => {
        const newJobs: UploadJob[] = files.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            status: 'pending'
        }));
        setJobs(prev => [...prev, ...newJobs]);

        // Process sequentially to respect quota and not overload the client
        for (const job of newJobs) {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'uploading' } : j));
            let stub: { id: string; properties: Record<string, unknown> } | null = null;
            // The store gets the record ONCE, in its final server version (addConfirmedPage ignores a page it already has).
            let latest: any = null;
            // Leave the record for a person, with its reason — never drop it.
            const toReview = async (reason: string) => {
                if (!stub) return;
                const res = await updatePageServerFirst(stub.id, { ...stub.properties, reviewStatus: 'Na te kijken', reviewReason: reason } as any);
                if (res.success) latest = res.page;
            };
            try {
                // 1. The record
                const pageRes = await createPageServerFirst(target, {
                    title: job.file.name,
                    reviewStatus: 'In verwerking',
                    source: 'src-scan',
                });
                if (!pageRes.success || !pageRes.page) throw new Error('Record kon niet worden aangemaakt');
                stub = { id: pageRes.page.id, properties: { ...(pageRes.page.properties as Record<string, unknown>) } };
                latest = pageRes.page;

                // 2. The file — shrunk if it is a large photo (MOBILE-SCAN-1: sent as is it exceeded the platform's request
                //    limit), stored, then LINKED to the record
                const file = await prepareUpload(job.file);
                if (file.size > MAX_UPLOAD_BYTES) throw new Error(tooLargeMessage(file.size));
                const fd = new FormData();
                fd.append('file', file);
                const uploadRes = await uploadFileAction(fd, isTickets ? 'receipt' : 'purchase-invoice', stub.id);
                if (!uploadRes.success || !uploadRes.key) throw new Error(uploadRes.error || 'Upload mislukt');
                stub.properties = { ...stub.properties, receiptUrl: uploadRes.key };
                const linked = await updatePageServerFirst(stub.id, stub.properties as any);
                if (!linked.success) throw new Error(linked.error || 'Bestand kon niet worden gekoppeld');
                latest = linked.page;

                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));

                // 3. The reading. FREE reads images in the browser (Tesseract); a PDF on FREE is entered by hand.
                const scanFd = new FormData();
                scanFd.append('file', file);
                scanFd.append('targetDb', target);
                scanFd.append('pageId', stub.id);
                if (isFree) {
                    if (!file.type.startsWith('image/')) {
                        await toReview('PDF lezen vraagt PRO — handmatig invullen');
                        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: 'Na te kijken — handmatig' } : j));
                        continue;
                    }
                    const { recognizeReceipt } = await import('@/lib/ocr');
                    const r = await recognizeReceipt(file);
                    scanFd.append('clientExtracted', JSON.stringify(isTickets
                        ? { merchant: r.extractedMerchant, date: r.extractedDate, totalAmount: r.extractedAmount, category: null }
                        : { supplierName: r.extractedMerchant, issueDate: r.extractedDate, totalExVat: r.extractedAmount, totalVat: r.extractedVatAmount, lines: [] }));
                }

                const scanRes = await fetch('/api/scan', { method: 'POST', body: scanFd });
                const scanData = await scanRes.json();
                if (!scanRes.ok || !scanData.success) {
                    await toReview(`Lezen mislukt: ${scanData?.error || scanRes.status}`);
                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: 'Na te kijken — lezen mislukt' } : j));
                    continue;
                }
                if (scanData.page) latest = scanData.page;

                const reviewStatus = scanData.page?.properties?.reviewStatus;
                // DUP-1: a possible duplicate is saved and flagged — said here, decided in Te valideren
                const verdictText = scanData.dedupResult && scanData.dedupResult.status !== 'none' ? 'Na te kijken — mogelijk duplicaat'
                    : reviewStatus === 'Klaar' ? 'Klaar om goed te keuren' : 'Na te kijken';
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: verdictText } : j));
            } catch (err: any) {
                await toReview(`Import onderbroken: ${err?.message || 'fout'}`).catch(() => {});
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: err.message } : j));
            } finally {
                if (latest) {
                    useDatabaseStore.getState().addConfirmedPage(latest);
                    // what was read, on the row — the import used to say only "Klaar"
                    const props = (latest.properties || {}) as Record<string, unknown>;
                    const pageId = String(latest.id);
                    setJobs(prev => prev.map(j => j.id === job.id ? {
                        ...j, pageId,
                        summary: readingSummary(role, props),
                        reason: props.reviewStatus === 'Klaar' ? '' : String(props.reviewReason || ''),
                    } : j));
                }
            }
        }
    }, [target, isTickets, isFree, role]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFiles(files);
    }, [handleFiles]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) handleFiles(files);
        e.target.value = '';
    };

    return (
        <div ref={modalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 relative max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">AI Document Import</h2>
                            <div className="mt-1 inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 text-xs font-semibold">
                                {([['db-expenses', 'Aankoopfacturen'], ['db-tickets', 'Tickets'], ['db-purchase-quotes', 'Offertes']] as const).map(([k, label]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        disabled={jobs.some(j => j.status === 'uploading' || j.status === 'processing')}
                                        onClick={() => setKind(k)}
                                        className={`px-2.5 py-1 rounded-md transition-colors ${kind === k ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Dropzone */}
                <div className="p-6 overflow-y-auto">
                    <div 
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                            border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200
                            ${isDragging 
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' 
                                : 'border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                            }
                        `}
                    >
                        <Upload className={`w-10 h-10 mb-4 ${isDragging ? 'text-indigo-500' : 'text-neutral-400'}`} />
                        <h3 className="text-base font-medium text-neutral-900 dark:text-white mb-1">Click or drag files here</h3>
                        <p className="text-sm text-neutral-500">Supports PDF, JPG, PNG (multiple files allowed)</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={READABLE_ACCEPT}
                            className="hidden"
                            onChange={handleInputChange}
                        />
                    </div>

                    {/* Jobs List */}
                    {jobs.length > 0 && (
                        <div className="mt-6 space-y-2">
                            {jobs.map(job => (
                                <div key={job.id}
                                     onClick={() => { if (job.pageId) openInValidation(job.pageId); }}
                                     className={`flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 ${job.pageId ? 'cursor-pointer hover:border-orange-300 dark:hover:border-orange-500/40' : ''}`}
                                     title={job.pageId ? 'Openen in Te valideren' : undefined}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <span className="block text-sm font-medium text-neutral-900 dark:text-white truncate">{job.summary || job.file.name}</span>
                                            {job.summary && <span className="block text-[11px] text-neutral-400 truncate">{job.file.name}</span>}
                                            {job.reason && <span className="block text-[11px] text-amber-600 dark:text-amber-400 truncate">{job.reason}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                        {job.status === 'pending' && <span className="text-xs text-neutral-500">Waiting...</span>}
                                        {job.status === 'uploading' && <><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /><span className="text-xs text-blue-500">Uploading...</span></>}
                                        {job.status === 'processing' && <><Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /><span className="text-xs text-indigo-500">Scanning...</span></>}
                                        {job.status === 'done' && <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-500 truncate max-w-[180px]">{job.verdict || 'Klaar'}</span></>}
                                        {job.status === 'error' && <><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-red-500 truncate max-w-[150px]">{job.error}</span></>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {jobs.filter(j => j.status === 'done').length > 0 && (
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => openInValidation()}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <Inbox className="w-4 h-4" />
                                {needsValidation(role) ? 'Naar Te valideren' : 'Naar offertes'} ({jobs.filter(j => j.status === 'done').length})
                                <ArrowRight className="w-4 h-4 opacity-70" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
