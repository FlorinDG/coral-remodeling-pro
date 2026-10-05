/**
 * Pure intent builders and options for Action writes onto the saveRecord door (R2-1-B M1).
 *
 * Rules:
 * - Only changed fields in intent.fields (no spreading existing properties).
 * - Exact caller 'by' tags ('client:link', 'system:payment-match', userId).
 * - C1: No lifecycle option here (lifecycle is reserved exclusively for payment-status sync & overdue cron).
 */

import type { RecordIntent } from '@/lib/records/record-intent';
import type { RecordMeta, CreateIfMissing } from '@/lib/data/records';

export interface AcceptDocumentPayload {
    signatureBase64: string;
    signatureMethod: string;
    consentName: string;
}

export function buildAcceptInvoiceIntent(
    invoiceId: string,
    payload: AcceptDocumentPayload,
    baseUpdatedAt: string,
    nowIso?: string
): { intent: RecordIntent; opts: { by: string } } {
    return {
        intent: {
            pageId: invoiceId,
            fields: {
                status: 'ACCEPTED',
                clientSignature: payload.signatureBase64,
                signatureMethod: payload.signatureMethod,
                consentName: payload.consentName,
                signedAt: nowIso ?? new Date().toISOString(),
            },
            baseUpdatedAt,
        },
        opts: { by: 'client:link' },
    };
}

export function buildAcceptQuoteIntent(
    quoteId: string,
    payload: AcceptDocumentPayload,
    baseUpdatedAt: string,
    nowIso?: string
): { intent: RecordIntent; opts: { by: string } } {
    return {
        intent: {
            pageId: quoteId,
            fields: {
                status: 'opt-accepted',
                clientSignature: payload.signatureBase64,
                signatureMethod: payload.signatureMethod,
                consentName: payload.consentName,
                signedAt: nowIso ?? new Date().toISOString(),
            },
            baseUpdatedAt,
        },
        opts: { by: 'client:link' },
    };
}

export function buildPaymentMatchIntent(
    paymentPageId: string,
    matchedInvoiceId: string,
    baseUpdatedAt: string
): { intent: RecordIntent; opts: { by: string } } {
    return {
        intent: {
            pageId: paymentPageId,
            fields: { invoice: [matchedInvoiceId] },
            baseUpdatedAt,
        },
        opts: { by: 'system:payment-match' },
    };
}

export function buildPaymentSuggestedMatchIntent(
    paymentPageId: string,
    suggestedInvoiceId: string,
    baseUpdatedAt: string
): { intent: RecordIntent; opts: { by: string } } {
    return {
        intent: {
            pageId: paymentPageId,
            fields: { suggestedInvoice: [suggestedInvoiceId] },
            baseUpdatedAt,
        },
        opts: { by: 'system:payment-match' },
    };
}

export function resolveTaskPriority(priority?: string): string {
    if (!priority) return 'opt-p4';
    const val = priority.toLowerCase();
    if (val.includes('p1') || val.includes('urgent')) return 'opt-p1';
    if (val.includes('p2') || val.includes('high')) return 'opt-p2';
    if (val.includes('p3') || val.includes('normal') || val.includes('med')) return 'opt-p3';
    if (val.includes('p4') || val.includes('low')) return 'opt-p4';
    return 'opt-p4';
}

export interface TaskCreateInput {
    title: string;
    status?: string;
    priority?: string;
    projectId?: string;
    assignee?: string;
    dueDate?: string;
    tags?: string[];
    section?: string;
    notes?: string;
}

export function buildTaskCreateData(
    pageId: string,
    databaseId: string,
    userId: string,
    order: number,
    input: TaskCreateInput,
    nowIso?: string
): {
    intent: RecordIntent;
    opts: { by: string; meta: RecordMeta; createIfMissing: CreateIfMissing };
} {
    const now = nowIso ?? new Date().toISOString();
    const taskFields: Record<string, unknown> = {
        title: input.title,
        'prop-task-status': input.status || 'opt-todo',
        'prop-task-priority': resolveTaskPriority(input.priority),
        'prop-task-project': input.projectId ? [input.projectId] : [],
        'prop-task-assignee': input.assignee ? [input.assignee] : [],
        'prop-task-due': input.dueDate || '',
        'prop-task-tags': input.tags || [],
        'prop-task-section': input.section || '',
        'prop-task-notes': input.notes || '',
        'prop-task-my-day': false,
        'prop-task-flagged': false,
        'prop-task-defer': '',
        'prop-task-recurrence': '',
        'prop-task-estimated': null,
        'prop-task-completed-at': '',
        'prop-task-reviewed-at': '',
        'prop-task-depends-on': [],
        created: now,
        last_edited_time: now,
    };

    return {
        intent: {
            pageId,
            fields: taskFields,
        },
        opts: {
            by: userId,
            meta: {
                order,
            },
            createIfMissing: {
                databaseId,
                properties: taskFields,
                blocks: [],
                createdBy: userId,
                assignedTo: input.assignee ? [input.assignee] : [],
            },
        },
    };
}

export function buildTaskStatusIntent(
    pageId: string,
    status: string,
    userId: string,
    baseUpdatedAt: string,
    nowIso?: string
): { intent: RecordIntent; opts: { by: string } } {
    const now = nowIso ?? new Date().toISOString();
    return {
        intent: {
            pageId,
            fields: {
                'prop-task-status': status,
                'prop-task-completed-at': status === 'opt-done' ? now : '',
                last_edited_time: now,
            },
            baseUpdatedAt,
        },
        opts: { by: userId },
    };
}
