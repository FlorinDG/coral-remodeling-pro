"use client";

import { useRouter } from "@/i18n/routing";
import { Plus } from "lucide-react";
import { useDatabaseStore } from "@/components/admin/database/store";
import { createPageServerFirst } from "@/app/actions/pages";
import { getNextDocumentNumber } from "@/app/actions/next-document-number";
import { useTenant } from "@/context/TenantContext";
import { useState } from "react";

export default function CreateQuotationButton() {
    const router = useRouter();
    const { resolveDbId } = useTenant();
    const addConfirmedPage = useDatabaseStore(state => state.addConfirmedPage);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (isCreating) return;
        setIsCreating(true);

        try {
            // Resolve the correct tenant-scoped DB ID
            // Falls back to 'db-quotations' for FOUNDER/legacy tenants
            const quotationsDbId = resolveDbId('db-quotations');

            // Generate the next sequential quotation number
            const result = await getNextDocumentNumber('quotation');
            const quoteNumber = result.success && result.number
                ? result.number
                : `OFT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

            // Server-first: persist in Postgres before navigating
            const pageResult = await createPageServerFirst(quotationsDbId, {
                title: quoteNumber,
                status: 'opt-draft',
                betreft: '',
                client: [],
            });

            if (!pageResult.success) {
                console.error('[CreateQuotationButton] failed:', pageResult.error);
                setIsCreating(false);
                return;
            }

            // Inject into Zustand so the engine renders immediately without a re-fetch
            addConfirmedPage(pageResult.page);

            // Navigate to the full engine view
            router.push(`/admin/quotations/${pageResult.page.id}`);
        } catch (e) {
            console.error('[CreateQuotationButton] unexpected error:', e);
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
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'New Quotation'}
        </button>
    );
}
