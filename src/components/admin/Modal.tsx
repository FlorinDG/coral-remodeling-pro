"use client";

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div className="relative w-full max-w-lg bg-neutral-50 dark:bg-black rounded-[2.5rem] shadow-2xl border border-neutral-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">{title}</h2>
                            <div className="h-1 w-12 bg-[#d35400] rounded-full mt-2" />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-neutral-200 dark:hover:bg-white/5 rounded-full transition-colors text-neutral-500 dark:text-neutral-400"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
