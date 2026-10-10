/**
 * Pure intent builders and options for Cron and Background Route writes onto the saveRecord door (R2-1-B M2).
 *
 * Rules:
 * - Only changed fields in intent.fields (no spreading existing properties).
 * - Exact caller 'by' tag ('system:cron-overdue').
 * - C1: the lifecycle option (reason: 'cron-overdue') lets the overdue status reach an accountant-exported document.
 * (The Peppol backfill's builders were deleted with its route on 2026-10-10 — a one-time repair, Florin.)
 */

import type { RecordIntent } from './record-intent';

export function buildOverdueDocumentIntent(
    pageId: string,
    baseUpdatedAt?: string | null
): {
    intent: RecordIntent;
    opts: { by: string; lifecycle: { reason: string } };
} {
    return {
        intent: {
            pageId,
            fields: { status: 'opt-overdue' },
            baseUpdatedAt: baseUpdatedAt ?? null,
        },
        opts: {
            by: 'system:cron-overdue',
            lifecycle: { reason: 'cron-overdue' },
        },
    };
}

export const buildOverdueInvoiceIntent = buildOverdueDocumentIntent;
export const buildOverdueExpenseIntent = buildOverdueDocumentIntent;
