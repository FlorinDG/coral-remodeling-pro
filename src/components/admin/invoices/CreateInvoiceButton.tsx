"use client";

import { useRouter } from "@/i18n/routing";
import { Plus } from "lucide-react";
import { useDatabaseStore } from "@/components/admin/database/store";
import { createPrismaInvoice } from "@/app/actions/create-invoice";
import { getNextDocumentNumber } from "@/app/actions/next-document-number";
import { createPageServerFirst } from "@/app/actions/pages";
import { useTenant } from "@/context/TenantContext";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function CreateInvoiceButton() {
    const router = useRouter();
    const { resolveDbId } = useTenant();
    const addConfirmedPage = useDatabaseStore(state => state.addConfirmedPage);
    const [isCreating, setIsCreating] = useState(false);
    const t = useTranslations('Admin');

    const handleCreate = async () => {
        if (isCreating) return;
        setIsCreating(true);

        try {
            const result = await getNextDocumentNumber('invoice');
            const invoiceNumber = result.success && result.number
                ? result.number
                : `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

            // Resolve tenant-scoped DB ID — falls back to bare 'db-invoices' for legacy FOUNDER accounts
            const invoicesDbId = resolveDbId('db-invoices');

            // 1. Server-first: create the page in Postgres, get confirmed ID back
            const pageResult = await createPageServerFirst(invoicesDbId, {
                title: invoiceNumber,
                docType: 'opt-invoice',
                status: 'opt-draft',
            });

            if (!pageResult.success) {
                console.error('[CreateInvoiceButton] page create failed:', pageResult.error);
                setIsCreating(false);
                return;
            }

            // 2. Inject confirmed page into the Zustand store (no duplicate sync)
            addConfirmedPage(pageResult.page);

            // 3. Create the Prisma invoice record with the confirmed page ID
            await createPrismaInvoice(pageResult.page.id, invoiceNumber);

            // 4. Redirect to the engine
            router.push(`/admin/financials/income/invoices/${pageResult.page.id}`);
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
            {isCreating ? t('db.toolbar.creating') : t('db.toolbar.createInvoice')}
        </button>
    );
}
