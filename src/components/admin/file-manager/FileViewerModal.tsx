import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { FileNode } from './types';

interface FileViewerModalProps {
    file: FileNode;
    onClose: () => void;
}

export default function FileViewerModal({ file, onClose }: FileViewerModalProps) {
    // Google Drive webViewLinks typically end in /view?usp=drivesdk
    // Changing /view to /preview makes them embeddable in iframes
    const previewUrl = file.url?.replace('/view', '/preview');

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
                        {file.url && (
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                title="Open natively in Google Drive"
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
                <div className="flex-1 w-full bg-[#f8f9fa] relative flex items-center justify-center overflow-hidden">
                    {previewUrl ? (
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-0"
                            title={file.name}
                            allow="autoplay"
                        />
                    ) : (
                        <div className="flex flex-col items-center text-neutral-500">
                            <p>Preview not available for this file type.</p>
                            <a href={file.url || '#'} target="_blank" rel="noopener noreferrer" className="mt-4 text-blue-400 hover:underline">
                                Open in Google Drive natively
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
