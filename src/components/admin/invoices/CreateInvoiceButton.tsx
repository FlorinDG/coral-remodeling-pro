"use client";

import { useRouter } from "@/i18n/routing";
import { Plus } from "lucide-react";
import { useDatabaseStore } from "@/components/admin/database/store";
import { createPrismaInvoice } from "@/app/actions/create-invoice";
import { getNextDocumentNumber } from "@/app/actions/next-document-number";
import { useState } from "react";

export default function CreateInvoiceButton() {
    const router = useRouter();
    const createPage = useDatabaseStore(state => state.createPage);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (isCreating) return;
        setIsCreating(true);

        try {
            // Get the next invoice number from the tenant's configured pattern
            const result = await getNextDocumentNumber('invoice');
            const invoiceNumber = result.success && result.number
                ? result.number
                : `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

            // 1. Add to client-side Zustand store for the Document Engine
            const newPage = createPage('db-invoices', {
                title: invoiceNumber,
                docType: 'opt-invoice',
                status: 'opt-draft',
            });

            if (!newPage) { setIsCreating(false); return; }

            // 2. Add to server-side Prisma store for the List view
            await createPrismaInvoice(newPage.id, invoiceNumber);

            // 3. Redirect to the engine
            router.push(`/admin/financials/income/invoices/${newPage.id}`);
        } catch (e) {
            console.error('Failed to create invoice:', e);
        }
        setIsCreating(false);
    };

    return (
        <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-all disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
        >
            {isCreating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Plus className="w-4 h-4" />
            )}
            {isCreating ? 'Creating...' : 'Create Invoice'}
        </button>
    );
}
