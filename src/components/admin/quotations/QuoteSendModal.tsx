import React, { useState, useEffect } from 'react';
import { X, Paperclip, Send, Loader2, FileText, CheckSquare, Square } from 'lucide-react';
import { listRecordFiles } from '@/app/actions/list-record-files';

interface QuoteSendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (subjectOverride: string, bodyOverride: string, attachmentKeys: string[]) => Promise<void>;
    clientEmail: string;
    defaultSubject: string;
    defaultBody: string;
    projectId?: string;
    documentId: string;
    documentType: 'quotation' | 'invoice';
    documentFileName: string;
    isSending: boolean;
}

export function QuoteSendModal({
    isOpen,
    onClose,
    onSend,
    clientEmail,
    defaultSubject,
    defaultBody,
    projectId,
    documentId,
    documentType,
    documentFileName,
    isSending
}: QuoteSendModalProps) {
    const [subject, setSubject] = useState(defaultSubject);
    const [body, setBody] = useState(defaultBody);
    const [availableFiles, setAvailableFiles] = useState<{ key: string, filename: string, size: number }[]>([]);
    const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(new Set());
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSubject(defaultSubject);
            setBody(defaultBody);
            setSelectedFileKeys(new Set());
            loadFiles();
        }
    }, [isOpen, defaultSubject, defaultBody, projectId, documentId]);

    const loadFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const allFiles: { key: string, filename: string, size: number }[] = [];
            
            // Load project files
            if (projectId) {
                const projRes = await listRecordFiles('project', projectId);
                if (projRes.success && projRes.files) {
                    allFiles.push(...projRes.files);
                }
            }

            // Load document specific files (if any)
            if (documentId) {
                const docRes = await listRecordFiles(documentType, documentId);
                if (docRes.success && docRes.files) {
                    allFiles.push(...docRes.files);
                }
            }

            setAvailableFiles(allFiles);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    if (!isOpen) return null;

    const toggleFile = (key: string) => {
        const next = new Set(selectedFileKeys);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedFileKeys(next);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 shrink-0">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Bericht opstellen</h2>
                    <button 
                        onClick={onClose}
                        disabled={isSending}
                        className="p-2 -mr-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Headers (To / Subject) */}
                    <div className="space-y-4">
                        <div className="flex items-center border-b border-neutral-200 dark:border-white/10 pb-2">
                            <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-24">Aan:</label>
                            <input 
                                type="text"
                                readOnly
                                value={clientEmail}
                                className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white outline-none cursor-not-allowed opacity-80"
                            />
                        </div>
                        <div className="flex items-center border-b border-neutral-200 dark:border-white/10 pb-2">
                            <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-24">Onderwerp:</label>
                            <input 
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="flex-1 bg-transparent text-sm font-medium text-neutral-900 dark:text-white outline-none"
                                placeholder="Onderwerp..."
                            />
                        </div>
                    </div>

                    {/* Email Body */}
                    <div className="flex flex-col h-48 border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            className="flex-1 p-4 bg-transparent text-sm text-neutral-900 dark:text-white outline-none resize-none leading-relaxed"
                            placeholder="Typ uw bericht hier..."
                        />
                    </div>

                    {/* Attachments Section */}
                    <div>
                        <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-neutral-400" />
                            Bijlagen
                        </h3>
                        <div className="bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 rounded-lg p-2 space-y-1">
                            {/* Primary PDF (Always checked, locked) */}
                            <div className="flex items-center gap-3 p-2 rounded-md bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                                <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-sm text-neutral-700 dark:text-neutral-200 truncate flex-1 font-medium">{documentFileName}</span>
                                <span className="text-xs text-neutral-400 shrink-0">Genereert nu...</span>
                            </div>

                            {isLoadingFiles ? (
                                <div className="p-4 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                                </div>
                            ) : availableFiles.length > 0 ? (
                                availableFiles.map(file => {
                                    const isSelected = selectedFileKeys.has(file.key);
                                    return (
                                        <div 
                                            key={file.key}
                                            onClick={() => toggleFile(file.key)}
                                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200 dark:border-white/10' 
                                                    : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                                            }`}
                                        >
                                            {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                                            ) : (
                                                <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                                            )}
                                            <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-neutral-400'}`} />
                                            <span className={`text-sm truncate flex-1 ${isSelected ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-600 dark:text-neutral-400'}`}>
                                                {file.filename}
                                            </span>
                                            <span className="text-xs text-neutral-400 shrink-0">
                                                {formatSize(file.size)}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-3 text-sm text-neutral-500 dark:text-neutral-400 italic text-center">
                                    Geen extra bestanden in het project.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-white/10 shrink-0 bg-neutral-50 dark:bg-neutral-900/50">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        Annuleren
                    </button>
                    <button
                        onClick={() => onSend(subject, body, Array.from(selectedFileKeys))}
                        disabled={isSending || !subject.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Verzenden...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Versturen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
