"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight, Download, FileText, File as FileIcon } from 'lucide-react';
import { useScrollLock } from '@/components/mobile/useScrollLock';

export interface ViewableFile {
    id: string;
    name: string;
    url?: string;
    mimeType?: string;
    type?: string;
    size?: number;
    pending?: boolean;
}

export interface FileViewerProps {
    isOpen?: boolean;
    files: ViewableFile[];
    index: number;
    onIndexChange?: (newIndex: number) => void;
    onClose: () => void;
}

export default function FileViewer({
    isOpen = true,
    files,
    index,
    onIndexChange,
    onClose,
}: FileViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const file = files[index];

    // Lock nearest scrollable ancestor while viewer is open
    useScrollLock(isOpen && Boolean(file), containerRef);

    const rawUrl = file?.url || '';
    const isDataUrl = rawUrl.startsWith('data:');
    const isHttpUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const isApiUrl = rawUrl.startsWith('/api/files/');

    const displayUrl = useMemo(() => {
        if (!rawUrl) return '';
        if (isDataUrl || isHttpUrl || isApiUrl) return rawUrl;
        return `/api/files/${encodeURIComponent(rawUrl)}`;
    }, [rawUrl, isDataUrl, isHttpUrl, isApiUrl]);

    const downloadUrl = useMemo(() => {
        if (!displayUrl) return '';
        if (isDataUrl) return displayUrl;
        const separator = displayUrl.includes('?') ? '&' : '?';
        return `${displayUrl}${separator}download=1`;
    }, [displayUrl, isDataUrl]);

    // Google Drive webViewLinks typically end in /view?usp=drivesdk -> /preview
    const previewUrl = useMemo(() => {
        if (!displayUrl) return '';
        if (isHttpUrl && displayUrl.includes('drive.google.com') && displayUrl.includes('/view')) {
            return displayUrl.replace('/view', '/preview');
        }
        return displayUrl;
    }, [displayUrl, isHttpUrl]);

    const mime = (file?.mimeType || file?.type || '').toLowerCase();
    const fileName = (file?.name || '').toLowerCase();

    const isImage = mime.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg|bmp|ico|avif)$/i.test(fileName);
    const isPdf = mime.includes('pdf') || /\.pdf$/i.test(fileName);
    const isText = mime.startsWith('text/') || /\.(txt|md|csv|json|log)$/i.test(fileName);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft') {
                if (index > 0 && onIndexChange) onIndexChange(index - 1);
            } else if (e.key === 'ArrowRight') {
                if (index < files.length - 1 && onIndexChange) onIndexChange(index + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, files.length, onIndexChange, onClose]);

    if (!isOpen || !file) return null;

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-sm p-0 md:p-6 animate-in fade-in duration-200 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-label={file.name}
        >
            <div className="relative w-full h-[100dvh] md:h-full md:max-h-[88vh] md:max-w-5xl bg-neutral-900 md:rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-neutral-950/90 border-b border-white/10 shrink-0 z-10">
                    <div className="flex items-center gap-2 md:gap-3 truncate pr-2">
                        {files.length > 1 && (
                            <span className="text-[11px] font-mono text-neutral-400 font-semibold shrink-0">
                                {index + 1} / {files.length}
                            </span>
                        )}
                        <span className="font-semibold text-sm md:text-base text-white truncate">
                            {file.name}
                        </span>
                        {file.size ? (
                            <span className="text-[10px] text-neutral-400 bg-white/10 px-2 py-0.5 rounded-md shrink-0 hidden sm:inline-block">
                                {formatSize(file.size)}
                            </span>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {downloadUrl && (
                            <a
                                href={downloadUrl}
                                download={file.name}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                title="Download"
                                aria-label="Download file"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        )}
                        {displayUrl && (
                            <a
                                href={displayUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                title="Open in new tab"
                                aria-label="Open in new tab"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                            title="Close viewer"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 w-full bg-neutral-950 relative flex items-center justify-center overflow-auto p-2 sm:p-4">
                    {isImage && previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={previewUrl}
                            alt={file.name}
                            className="max-w-full max-h-full object-contain select-none rounded-lg"
                        />
                    ) : isPdf && previewUrl ? (
                        <div className="w-full h-full flex flex-col">
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border-0 rounded-lg bg-neutral-800"
                                title={file.name}
                            />
                        </div>
                    ) : isText && previewUrl ? (
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-0 rounded-lg bg-neutral-900 text-white p-2 font-mono text-xs"
                            title={file.name}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-6 max-w-sm">
                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-neutral-400">
                                <FileIcon className="w-8 h-8" />
                            </div>
                            <p className="text-white font-medium text-sm mb-1 truncate max-w-full">
                                {file.name}
                            </p>
                            <p className="text-neutral-400 text-xs mb-4">
                                {file.size ? formatSize(file.size) : 'File preview unavailable'}
                            </p>
                            {downloadUrl && (
                                <a
                                    href={downloadUrl}
                                    download={file.name}
                                    className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download File</span>
                                </a>
                            )}
                        </div>
                    )}

                    {/* Navigation Arrows */}
                    {index > 0 && onIndexChange && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(index - 1)}
                            className="min-w-[44px] min-h-[44px] absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md border border-white/15 shadow-xl"
                            aria-label="Previous file"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {index < files.length - 1 && onIndexChange && (
                        <button
                            type="button"
                            onClick={() => onIndexChange(index + 1)}
                            className="min-w-[44px] min-h-[44px] absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md border border-white/15 shadow-xl"
                            aria-label="Next file"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
