'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import type { Database } from '../types';
import { useDatabaseStore } from '../store';
import { getDatabaseRoute, opensInSideModal } from '@/lib/databaseRoute';
import { useRecordPeek } from '@/lib/record-peek';
import { resolveRelationTarget } from '@/lib/relations/resolve';

/**
 * CROSS-LINK-1 · open a linked record: in the side modal (in place, editable), or — for an invoice / quotation,
 * which have their own editor — on its page. `target` is the database object or its id (a base id resolves
 * through the tenant's binding).
 */
export function useOpenLinkedRecord() {
    const router = useRouter();
    const locale = useLocale();
    const open = useRecordPeek(s => s.open);
    return useCallback((target: Database | string | null | undefined, pageId: string) => {
        if (!target || !pageId) return;
        const db: Database | undefined = typeof target === 'object'
            ? target
            : useDatabaseStore.getState().databases.find(d => d.id === resolveRelationTarget(target).databaseId);
        const databaseId = typeof target === 'object' ? target.id : (db?.id ?? resolveRelationTarget(target).databaseId);
        const role = db?.logicalKey ?? null;
        if (opensInSideModal(role)) {
            if (!databaseId) { toast.error('Kan record niet openen: onbekende database'); return; }
            open(databaseId, pageId);
            return;
        }
        const route = getDatabaseRoute(db ?? role, pageId);
        if (!route) { toast.error(`Kan record niet openen: onbekende database (${db?.name || databaseId})`); return; }
        router.push(`/${locale}${route}`);
    }, [router, locale, open]);
}
