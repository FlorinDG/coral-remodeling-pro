"use client";

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface InlineDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger' | 'info';
}

export default function InlineDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Bevestigen',
    cancelLabel = 'Annuleren',
    variant = 'default',
}: InlineDialogProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const confirmColors = {
        default: 'text-white hover:opacity-90',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        info: 'text-white hover:opacity-90',
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-white/10 w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-0">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-neutral-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {message}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 px-5 pb-5">
                    <button
                        onClick={onClose}
                        className="text-xs font-semibold px-4 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/10 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${confirmColors[variant]}`}
                        style={{
                            backgroundColor: variant !== 'danger' ? 'var(--brand-color, #d35400)' : undefined,
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
