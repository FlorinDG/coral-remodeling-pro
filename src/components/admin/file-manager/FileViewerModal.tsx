import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { FileNode } from './types';

interface FileViewerModalProps {
    file: FileNode;
    onClose: () => void;
}

export default function FileViewerModal({ file, onClose }: FileViewerModalProps) {
    const isBlobFile = file.url?.startsWith('/api/files/') || file.url?.startsWith('t_');
    const displayUrl = file.url?.startsWith('t_') ? `/api/files/${file.url}` : file.url;
    
    // Google Drive webViewLinks typically end in /view?usp=drivesdk
    // Changing /view to /preview makes them embeddable in iframes
    const previewUrl = isBlobFile ? displayUrl : file.url?.replace('/view', '/preview');

    const isImage = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
    const isPdf = file.mimeType?.includes('pdf') || /\.pdf$/i.test(file.name);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
            <div className="relative w-full h-full max-w-6xl bg-neutral-900 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3 truncate">
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
                </div>
            </div>
        </div>
    );
}
