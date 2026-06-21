"use client";

import { useRouter } from "@/i18n/routing";
import { Plus, Loader2 } from "lucide-react";
import { useDatabaseStore } from "@/components/admin/database/store";
import { createPageServerFirst } from "@/app/actions/pages";
import { getNextDocumentNumber } from "@/app/actions/next-document-number";
import { generateClientSideDocNumber } from "@/lib/docNumberFallback";
import { useTenant } from "@/context/TenantContext";
import { useState } from "react";

interface MobileCreateQuoteButtonProps {
    label: string;
}

export default function MobileCreateQuoteButton({ label }: MobileCreateQuoteButtonProps) {
    const router = useRouter();
    const { resolveDbId, tenant } = useTenant();
    const addConfirmedPage = useDatabaseStore(state => state.addConfirmedPage);
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (isCreating) return;
        setIsCreating(true);

        try {
            const quotationsDbId = resolveDbId('db-quotations');

            const result = await getNextDocumentNumber('quotation');
            const quoteNumber = result.success && result.number
                ? result.number
                : generateClientSideDocNumber(tenant, 'quotation');

            const pageResult = await createPageServerFirst(quotationsDbId, {
                title: quoteNumber,
                status: 'opt-draft',
                betreft: '',
                client: [],
            });

            if (!pageResult.success) {
                console.error('[MobileCreateQuoteButton] failed:', pageResult.error);
                setIsCreating(false);
                return;
            }

            addConfirmedPage(pageResult.page);

            // Navigate to the mobile engine view
            router.push(`/m/quotes/${pageResult.page.id}`);
        } catch (e) {
            console.error('[MobileCreateQuoteButton] unexpected error:', e);
        }

        setIsCreating(false);
    };

    return (
        <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold shadow-sm active:scale-[0.97] transition-all disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-color, #d35400)' }}
        >
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {isCreating ? 'Creating...' : label}
        </button>
    );
}
