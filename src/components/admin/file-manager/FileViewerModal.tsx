import React, { useEffect } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { FileNode } from './types';

interface FileViewerModalProps {
    files: FileNode[];
    index: number;
    onIndexChange: (newIndex: number) => void;
    onClose: () => void;
}

export default function FileViewerModal({ files, index, onIndexChange, onClose }: FileViewerModalProps) {
    const file = files[index];
    const isBlobFile = file.url?.startsWith('/api/files/') || file.url?.startsWith('t_');
    const displayUrl = file.url?.startsWith('t_') ? `/api/files/${file.url}` : file.url;
    
    // Google Drive webViewLinks typically end in /view?usp=drivesdk
    // Changing /view to /preview makes them embeddable in iframes
    const previewUrl = isBlobFile ? displayUrl : file.url?.replace('/view', '/preview');

    const isImage = file?.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file?.name || '');
    const isPdf = file?.mimeType?.includes('pdf') || /\.pdf$/i.test(file?.name || '');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft') {
                if (index > 0) onIndexChange(index - 1);
            } else if (e.key === 'ArrowRight') {
                if (index < files.length - 1) onIndexChange(index + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, files.length, onIndexChange, onClose]);

    if (!file) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 md:p-8 animate-in fade-in duration-200">
            <div className="relative w-full h-full max-w-6xl bg-neutral-900 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-bold text-neutral-500 min-w-[3rem] whitespace-nowrap">
                            {index + 1} / {files.length}
                        </span>
                        <span className="font-medium text-white truncate">{file.name}</span>
                        <span className="text-xs text-neutral-400 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {file.mimeType?.split('/').pop() || 'File'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {displayUrl && (
                            <a
                                href={displayUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                title={isBlobFile ? "Open in new tab" : "Open natively in Google Drive"}
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 w-full bg-[#f8f9fa] dark:bg-neutral-950 relative flex items-center justify-center overflow-hidden">
                    {isImage && previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={previewUrl}
                            className="max-w-full max-h-full object-contain p-4"
                            alt={file.name}
                        />
                    ) : isPdf && previewUrl ? (
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title={file.name}
                            allow="autoplay"
                        />
                    ) : previewUrl && !isBlobFile ? (
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title={file.name}
                            allow="autoplay"
                        />
                    ) : (
                        <div className="flex flex-col items-center text-neutral-500 text-center p-6">
                            <p>Voorbeeld niet beschikbaar voor dit bestandstype.</p>
                            {displayUrl && (
                                <a
                                    href={displayUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Download / Open bestand
                                </a>
                            )}
                        </div>
                    )}
                    
                    {/* Navigation Arrows */}
                    {index > 0 && (
                        <button
                            onClick={() => onIndexChange(index - 1)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm border border-white/10 shadow-lg"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {index < files.length - 1 && (
                        <button
                            onClick={() => onIndexChange(index + 1)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm border border-white/10 shadow-lg"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
