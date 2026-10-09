/**
 * Pure intent builders and options for Portal and Export routes onto the saveRecord door (R2-1-B M4).
 *
 * Rules:
 * - Only changed fields in intent.fields (no spreading existing properties).
 * - Exact caller 'by' tags ('system:accountant-export', 'portal:client', or user ID).
 * - C1: NO lifecycle option on any of these writers (lifecycle is strictly for cron-overdue and invoice-payments).
 * - Row columns preserved: assignedTo: [] on new records, createdBy, lastEditedBy.
 */

import type { RecordIntent, CreateIfMissing } from './record-intent';

export interface AccountantExportActor {
    identifier: string;
    userId: string;
    email?: string | null;
    timestamp: string;
}

export function buildAccountantExportStampIntent(
    docId: string,
    actor: AccountantExportActor
): {
    intent: RecordIntent;
    opts: { by: string };
} {
    return {
        intent: {
            pageId: docId,
            fields: {
                accountantExportedAt: true,
                accountantExportedBy: actor.identifier,
                accountantExportedById: actor.userId,
                accountantExportedTimestamp: actor.timestamp,
            },
        },
        opts: {
            by: actor.email || actor.userId || 'system:accountant-export',
        },
    };
}

export interface PortalProjectInput {
    pageId: string;
    databaseId: string;
    projectTitle: string;
    clientName?: string | null;
    budget?: number | null;
    userId?: string | null;
}

export function buildPortalProjectCreateData(
    input: PortalProjectInput
): {
    intent: RecordIntent;
    opts: {
        by: string;
        createIfMissing: CreateIfMissing;
    };
} {
    const fields: Record<string, unknown> = {
        title: input.projectTitle,
        status: 'New',
        budget: input.budget || 0,
    };
    if (input.clientName) {
        fields.clientName = input.clientName;
    }
    const by = input.userId || 'system';
    return {
        intent: {
            pageId: input.pageId,
            fields,
        },
        opts: {
            by,
            createIfMissing: {
                databaseId: input.databaseId,
                properties: fields,
                createdBy: by,
                assignedTo: [],
            },
        },
    };
}

export interface PortalTaskCreateInput {
    pageId: string;
    databaseId: string;
    portalId: string;
    title: string;
    dueDate?: string | null;
    fileUrl?: string | null;
}

export function buildPortalTaskCreateData(
    input: PortalTaskCreateInput
): {
    intent: RecordIntent;
    opts: {
        by: string;
        createIfMissing: CreateIfMissing;
    };
} {
    const properties: Record<string, unknown> = {
        title: input.title,
        'prop-task-status': 'opt-todo',
        'prop-task-due': input.dueDate ? new Date(input.dueDate).toISOString() : '',
        'prop-task-file-url': input.fileUrl || '',
        'prop-task-portal': [input.portalId],
        'prop-task-priority': 'opt-p4',
        'prop-task-tags': [],
    };
    return {
        intent: {
            pageId: input.pageId,
            fields: properties,
        },
        opts: {
            by: 'portal:client',
            createIfMissing: {
                databaseId: input.databaseId,
                properties,
                createdBy: 'system:portal',
                assignedTo: [],
            },
        },
    };
}

export interface PortalTaskUpdateInput {
    pageId: string;
    title?: string;
    status?: string;
    dueDate?: string | null;
    fileUrl?: string | null;
}

export function buildPortalTaskUpdateIntent(
    input: PortalTaskUpdateInput
): {
    intent: RecordIntent;
    opts: { by: string };
} {
    const fields: Record<string, unknown> = {};
    if (input.title !== undefined) fields['title'] = input.title;
    if (input.status !== undefined) fields['prop-task-status'] = input.status === 'DONE' ? 'opt-done' : 'opt-todo';
    if (input.dueDate !== undefined) fields['prop-task-due'] = input.dueDate ? new Date(input.dueDate).toISOString() : '';
    if (input.fileUrl !== undefined) fields['prop-task-file-url'] = input.fileUrl || '';

    return {
        intent: {
            pageId: input.pageId,
            fields,
        },
        opts: {
            by: 'portal:client',
        },
    };
}
