"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Pencil, Eye, Download } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
    invoiceId: string;
    invoiceNumber: string;
}

export default function InvoiceActionDropdown({ invoiceId, invoiceNumber }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const editUrl = `/nl/admin/financials/income/invoices/${invoiceId}`;

    const handleView = () => {
        setOpen(false);
        // Open the invoice editor in a new tab for viewing
        window.open(editUrl, '_blank');
    };

    const handleEdit = () => {
        setOpen(false);
        router.push(editUrl);
    };

    const handleDownload = async () => {
        setOpen(false);
        // Navigate to edit page where PDF download is available
        router.push(editUrl);
    };

    return (
        <div ref={ref} className="relative inline-block text-left">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm"
            >
                Actions
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                        onClick={handleEdit}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left"
                    >
                        <Pencil className="w-3.5 h-3.5 text-neutral-400" />
                        Edit
                    </button>
                    <button
                        onClick={handleView}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left"
                    >
                        <Eye className="w-3.5 h-3.5 text-neutral-400" />
                        View
                    </button>
                    <div className="border-t border-neutral-100 dark:border-white/5 my-1" />
                    <button
                        onClick={handleDownload}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left"
                    >
                        <Download className="w-3.5 h-3.5 text-neutral-400" />
                        Download PDF
                    </button>
                </div>
            )}
        </div>
    );
}
