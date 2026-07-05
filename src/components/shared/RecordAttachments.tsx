"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, Upload, Loader2, FileText, Trash2, ExternalLink } from 'lucide-react';
import { listRecordFiles } from '@/app/actions/list-record-files';
import { uploadFileAction, deleteFileAction } from '@/app/actions/files';

interface RecordAttachmentsProps {
    recordType: string;
    recordId: string;
}

export function RecordAttachments({ recordType, recordId }: RecordAttachmentsProps) {
    const [files, setFiles] = useState<{ key: string, filename: string, size: number, url: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingFiles, setUploadingFiles] = useState<{ filename: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await listRecordFiles(recordType, recordId);
            if (res.success && res.files) {
                setFiles(res.files);
            }
        } catch (error) {
            console.error('Failed to fetch files', error);
        } finally {
            setIsLoading(false);
        }
    }, [recordType, recordId]);

    useEffect(() => {
        if (recordId) {
            fetchFiles();
        }
    }, [recordId, fetchFiles]);

    const handleUpload = async (fileList: File[]) => {
        if (!fileList.length) return;

        setUploadingFiles(prev => [...prev, ...fileList.map(f => ({ filename: f.name }))]);

        for (const file of fileList) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await uploadFileAction(formData, recordType, recordId);
                
                if (res.success && res.key) {
                    // Update list after each successful upload
                    fetchFiles();
                }
            } catch (err) {
                console.error('Upload error:', err);
            } finally {
                setUploadingFiles(prev => prev.filter(f => f.filename !== file.name));
            }
        }
    };

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = Array.from(e.target.files || []);
        handleUpload(fileList);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const fileList = Array.from(e.dataTransfer.files || []);
        handleUpload(fileList);
    };

    const handleDelete = async (key: string) => {
        if (!window.confirm('Are you sure you want to delete this attachment?')) return;
        
        try {
            const res = await deleteFileAction(key);
            if (res.success) {
                setFiles(prev => prev.filter(f => f.key !== key));
            } else {
                alert('Failed to delete file');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to delete file');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    if (!recordId) return null;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-neutral-500" />
                    Attachments
                </h3>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-white/10 rounded-lg transition-colors shadow-sm"
                >
                    <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={onFileSelect}
                />
            </div>
            
            <div className="p-4">
                <div 
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`space-y-2 rounded-xl transition-all ${
                        isDragging ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/50 p-2' : ''
                    }`}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center py-6 text-neutral-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {files.map(file => (
                                <div key={file.key} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-lg group hover:bg-white dark:hover:bg-neutral-800 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                            {file.filename}
                                        </p>
                                        <p className="text-xs text-neutral-500">
                                            {formatSize(file.size)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a 
                                            href={`/api/files/${encodeURIComponent(file.key)}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                            title="Open"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button 
                                            onClick={() => handleDelete(file.key)}
                                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {uploadingFiles.map((uf, idx) => (
                                <div key={`uf-${idx}`} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-lg opacity-70">
                                    <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                                        <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                            {uf.filename}
                                        </p>
                                        <p className="text-xs text-neutral-500">
                                            Uploading...
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {files.length === 0 && uploadingFiles.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-xl">
                                    <Upload className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                        No attachments yet
                                    </p>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Drag and drop files here, or click upload
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
