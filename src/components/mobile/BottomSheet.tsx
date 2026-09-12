'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    icon?: React.ReactNode;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxHeightClass?: string;
    bodyClassName?: string;
}

/**
 * TASK-M12: Canonical BottomSheet primitive for mobile.
 * Features:
 * - dvh sizing (never vh) to respect iOS browser address bar
 * - overscroll-behavior: contain to prevent background rubber-banding
 * - body scroll lock with reference-counted cleanup for sequential sheets
 * - fixed header, scrollable body, and fixed footer for primary/destructive actions (e.g. Delete)
 * - safe-area-inset-bottom padding in footer
 */
export function BottomSheet({
    isOpen,
    onClose,
    title,
    icon,
    headerRight,
    children,
    footer,
    maxHeightClass = 'max-h-[85dvh]',
    bodyClassName = 'p-4 text-xs',
}: BottomSheetProps) {
    // Body scroll lock with reference counting for nested/sequential sheets
    useEffect(() => {
        if (!isOpen) return;
        const currentLocks = parseInt(document.body.dataset.sheetLocks || '0', 10);
        if (currentLocks === 0) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        }
        document.body.dataset.sheetLocks = String(currentLocks + 1);

        return () => {
            const count = parseInt(document.body.dataset.sheetLocks || '1', 10) - 1;
            document.body.dataset.sheetLocks = String(Math.max(0, count));
            if (count <= 0) {
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                delete document.body.dataset.sheetLocks;
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-white/10 rounded-t-3xl max-w-lg mx-auto w-full ${maxHeightClass} flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Fixed Header */}
                {(title || icon || headerRight) && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-white/5 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            {icon}
                            {typeof title === 'string' ? (
                                <h3 className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                                    {title}
                                </h3>
                            ) : (
                                title
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {headerRight}
                            <button
                                type="button"
                                onClick={onClose}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 -mr-2"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Scrollable Body with overscroll containment */}
                <div className={`overflow-y-auto overscroll-contain flex-1 ${bodyClassName}`}>
                    {children}
                </div>

                {/* Fixed Footer (e.g. Delete, primary buttons, clears safe-area) */}
                {footer && (
                    <div className="shrink-0 px-4 py-3 border-t border-neutral-100 dark:border-white/5 bg-white dark:bg-neutral-900 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
