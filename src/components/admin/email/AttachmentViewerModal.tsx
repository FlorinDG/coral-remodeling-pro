import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/time-tracker/components/ui/dialog';

interface AttachmentViewerModalProps {
    attachment: {
        filename: string;
        contentType: string;
        data?: string;
        size?: number;
    } | null;
    onClose: () => void;
}

export function AttachmentViewerModal({ attachment, onClose }: AttachmentViewerModalProps) {
    if (!attachment || !attachment.data) return null;

    const isImage = attachment.contentType?.startsWith('image/');
    const isPDF = attachment.contentType === 'application/pdf';
    const isText = attachment.contentType?.startsWith('text/');
    const canPreview = isImage || isPDF || isText;

    const dataUri = `data:${attachment.contentType};base64,${attachment.data}`;

    return (
        <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl w-full h-[85vh] p-0 overflow-hidden bg-neutral-950 border-white/10 flex flex-col gap-0 gap-y-0 shadow-2xl">
                {/* Header built into the Modal for a native viewing experience */}
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3 truncate">
                        <DialogTitle className="font-medium text-white truncate m-0 text-base">
                            {attachment.filename}
                        </DialogTitle>
                        <span className="text-xs text-neutral-400 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {Math.round((attachment.size || 0) / 1024)} KB
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={dataUri}
                            download={attachment.filename}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Download Attachment"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Download</span>
                        </a>
                        <div className="w-[1px] h-4 bg-white/10 mx-2" />
                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Frame */}
                <div className="flex-1 w-full bg-[#f8f9fa] relative flex items-center justify-center overflow-auto h-full p-4 md:p-8">
                    {canPreview ? (
                        isImage ? (
                            <img
                                src={dataUri}
                                alt={attachment.filename}
                                className="max-w-full max-h-full object-contain rounded-md shadow-sm border border-border bg-white"
                            />
                        ) : (
                            <iframe
                                src={dataUri}
                                className="w-full h-full border-0 bg-white rounded-md shadow-sm"
                                title={attachment.filename}
                            />
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center text-neutral-500 gap-4 p-8 bg-white rounded-xl shadow-sm border border-border max-w-sm text-center">
                            <FileText className="w-16 h-16 text-neutral-300" />
                            <div>
                                <h3 className="text-foreground font-semibold mb-1">Preview not available</h3>
                                <p className="text-sm">This file type ({attachment.contentType}) cannot be previewed securely in the browser.</p>
                            </div>
                            <a
                                href={dataUri}
                                download={attachment.filename}
                                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download File
                            </a>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
