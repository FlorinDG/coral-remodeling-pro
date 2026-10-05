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
import { useOverlayEventShield } from '@/hooks/useOverlayEventShield';

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
}

/**
 * Bulk import — purchase invoices OR tickets (Florin 2026-10-05: "Bulk upload tickets, I asked for it a long time
 * ago"). Per file: a record, the file stored AND linked to it (receiptUrl — before, the upload was never linked:
 * bulk-imported documents had no file and the accountant export missed them), then the AI reading. Whatever the
 * reading cannot settle (duplicate, failed scan, FREE plan PDF) stays in the inbox as "Na te kijken" with its file:
 * a person decides, the import never discards.
 */
export default function AiDocumentImportModal({ onClose, targetDatabaseId = 'db-expenses', onComplete }: AiDocumentImportModalProps) {
    const [kind, setKind] = useState<'db-expenses' | 'db-tickets'>(isTenantDatabase(targetDatabaseId, 'db-tickets') ? 'db-tickets' : 'db-expenses');
    const target = kind;
    const isTickets = kind === 'db-tickets';
    const { planType } = useTenant();
    const isFree = (planType || 'FREE') === 'FREE';
    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    useOverlayEventShield(modalRef);
    const router = useRouter();
    const locale = useLocale();

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

                // 2. The file — stored, then LINKED to the record
                const fd = new FormData();
                fd.append('file', job.file);
                const uploadRes = await uploadFileAction(fd, isTickets ? 'receipt' : 'purchase-invoice', stub.id);
                if (!uploadRes.success || !uploadRes.key) throw new Error(uploadRes.error || 'Upload mislukt');
                stub.properties = { ...stub.properties, receiptUrl: uploadRes.key };
                const linked = await updatePageServerFirst(stub.id, stub.properties as any);
                if (!linked.success) throw new Error(linked.error || 'Bestand kon niet worden gekoppeld');
                latest = linked.page;

                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));

                // 3. The reading. FREE reads images in the browser (Tesseract); a PDF on FREE is entered by hand.
                const scanFd = new FormData();
                scanFd.append('file', job.file);
                scanFd.append('targetDb', target);
                scanFd.append('pageId', stub.id);
                if (isFree) {
                    if (!job.file.type.startsWith('image/')) {
                        await toReview('PDF lezen vraagt PRO — handmatig invullen');
                        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: 'Na te kijken — handmatig' } : j));
                        continue;
                    }
                    const { recognizeReceipt } = await import('@/lib/ocr');
                    const r = await recognizeReceipt(job.file);
                    scanFd.append('clientExtracted', JSON.stringify(isTickets
                        ? { merchant: r.extractedMerchant, date: r.extractedDate, totalAmount: r.extractedAmount, category: null }
                        : { supplierName: r.extractedMerchant, issueDate: r.extractedDate, totalExVat: r.extractedAmount, totalVat: r.extractedVatAmount, lines: [] }));
                }

                const scanRes = await fetch('/api/scan', { method: 'POST', body: scanFd });
                const scanData = await scanRes.json();
                if (scanRes.status === 409 && scanData?.code === 'DUPLICATE_DETECTED') {
                    await toReview('Mogelijk duplicaat');
                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: 'Na te kijken — mogelijk duplicaat' } : j));
                    continue;
                }
                if (!scanRes.ok || !scanData.success) {
                    await toReview(`Lezen mislukt: ${scanData?.error || scanRes.status}`);
                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: 'Na te kijken — lezen mislukt' } : j));
                    continue;
                }
                if (scanData.page) latest = scanData.page;

                const reviewStatus = scanData.page?.properties?.reviewStatus;
                const verdictText = reviewStatus === 'Klaar' ? 'Klaar' : (reviewStatus ? `Na te kijken — ${reviewStatus}` : 'Klaar');
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', verdict: verdictText } : j));
            } catch (err: any) {
                await toReview(`Import onderbroken: ${err?.message || 'fout'}`).catch(() => {});
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: err.message } : j));
            } finally {
                if (latest) useDatabaseStore.getState().addConfirmedPage(latest);
            }
        }
    }, [target, isTickets, isFree]);

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
        <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                                {([['db-expenses', 'Aankoopfacturen'], ['db-tickets', 'Tickets']] as const).map(([k, label]) => (
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
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleInputChange}
                        />
                    </div>

                    {/* Jobs List */}
                    {jobs.length > 0 && (
                        <div className="mt-6 space-y-2">
                            {jobs.map(job => (
                                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                                        <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{job.file.name}</span>
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
                                onClick={() => {
                                    if (onComplete) {
                                        onComplete();
                                    } else {
                                        router.push(`/${locale}${isTickets ? '/admin/financials/expenses/tickets' : '/admin/financials/expenses/invoices'}`);
                                    }
                                    onClose();
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <Inbox className="w-4 h-4" />
                                Bekijk in Inbox ({jobs.filter(j => j.status === 'done').length})
                                <ArrowRight className="w-4 h-4 opacity-70" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
