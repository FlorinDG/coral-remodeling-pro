import type { Database } from '@/components/admin/database/types';
import type { SystemDatabaseRole } from '@/lib/kernel/system-databases';

/**
 * Returns the deep-link route for a given system database page.
 * ARCHITECTURAL RULE (KERN-7): An id is never parsed. The binding is read.
 * Accepts either a Database object (reading logicalKey) or a SystemDatabaseRole string.
 */
export function getDatabaseRoute(
    target: Database | SystemDatabaseRole | string | null | undefined,
    pageId: string
): string | null {
    if (!target) return null;

    const role: string | undefined = typeof target === 'object'
        ? target.logicalKey || undefined
        : target;

    if (!role) return null;

    switch (role) {
        case 'clients': return `/admin/contacts?open=${pageId}`;
        case 'suppliers': return `/admin/suppliers?open=${pageId}`;
        case 'articles': return `/admin/library/articles?open=${pageId}`;
        case 'bestek': return `/admin/library/bestek?open=${pageId}`;
        case 'crm':
        case 'bobex': return `/admin/crm?open=${pageId}`;
        case 'tickets': return `/admin/financials/expenses/tickets?open=${pageId}`;
        case 'projects': return `/admin/projects-management?open=${pageId}`;
        case 'tasks': return `/admin/tasks?open=${pageId}`;
        case 'invoices': return `/admin/financials/income/invoices/${pageId}`;
        case 'expenses': return `/admin/financials/expenses/invoices?open=${pageId}`;
        case 'purchase-quotes': return `/admin/financials/expenses/quotes?open=${pageId}`;
        case 'quotations': return `/admin/quotations/${pageId}`;
        case 'payments-in': return `/admin/financials/income/payments?open=${pageId}`;
        case 'payments-out': return `/admin/financials/expenses/payments?open=${pageId}`;
        case 'hr': return `/admin/hr/timesheets?open=${pageId}`;
        case 'journal-general': return `/admin/journal?open=${pageId}`;
        default:
            return null;
    }
}

/**
 * CROSS-LINK-1 (Florin 2026-10-05: "the displayed record has a link to the original record that is supposed to
 * open in the side modal to allow edits"). A linked record opens IN PLACE, in the side modal — except the
 * documents that have their own full editor (an invoice, a quotation), which navigate to it.
 */
export function opensInSideModal(role: string | null | undefined): boolean {
    return role !== 'invoices' && role !== 'quotations';
}
