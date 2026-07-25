"use client";

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Loader2, Sparkles, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { createPageServerFirst } from '@/app/actions/pages';
import { uploadFileAction } from '@/app/actions/files';

interface AiDocumentImportModalProps {
    onClose: () => void;
    targetDatabaseId?: string;
}

interface UploadJob {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
    error?: string;
}

export default function AiDocumentImportModal({ onClose, targetDatabaseId = 'db-expenses' }: AiDocumentImportModalProps) {
    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            try {
                // 1. Create stub
                const page = await createPageServerFirst(targetDatabaseId, { 
                    title: job.file.name, 
                    reviewStatus: 'In verwerking', 
                    source: 'src-scan' 
                });

                if (!page) throw new Error("Failed to create record");

                // 2. Upload file
                const fd = new FormData();
                fd.append('file', job.file);
                const uploadRes = await uploadFileAction(fd, targetDatabaseId === 'db-expenses' ? 'purchase-invoice' : 'receipt', page.id);
                
                if (uploadRes.error) throw new Error("Upload failed");

                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));

                // 3. Trigger OCR
                const scanFd = new FormData();
                scanFd.append('file', job.file);
                scanFd.append('targetDb', targetDatabaseId);
                scanFd.append('pageId', page.id);

                const scanRes = await fetch('/api/scan', { method: 'POST', body: scanFd });
                const scanData = await scanRes.json();

                if (!scanRes.ok || !scanData.success) {
                    throw new Error(scanData.error || "Scan failed");
                }

                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done' } : j));
            } catch (err: any) {
                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: err.message } : j));
            }
        }
    }, [targetDatabaseId]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-800 relative max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">AI Document Import</h2>
                            <p className="text-sm text-neutral-500">Drop multiple invoices or receipts</p>
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
                                        {job.status === 'done' && <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-500">Done</span></>}
                                        {job.status === 'error' && <><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-red-500 truncate max-w-[150px]">{job.error}</span></>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
