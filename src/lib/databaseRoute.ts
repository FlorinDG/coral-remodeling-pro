import { getBaseDbId } from './systemDatabases';

export function getDatabaseRoute(databaseId: string, pageId: string): string | null {
    const baseId = getBaseDbId(databaseId);

    switch (baseId) {
        case 'db-clients': return `/admin/contacts?open=${pageId}`;
        case 'db-suppliers': return `/admin/suppliers?open=${pageId}`;
        case 'db-articles': return `/admin/library/articles?open=${pageId}`;
        case 'db-bestek': return `/admin/library/bestek?open=${pageId}`;
        case 'db-crm':
        case 'db-bobex': return `/admin/crm?open=${pageId}`;
        case 'db-tickets': return `/admin/financials/expenses/tickets?open=${pageId}`;
        case 'db-1': return `/admin/projects-management?open=${pageId}`;
        case 'db-tasks': return `/admin/tasks?open=${pageId}`;
        case 'db-invoices': return `/admin/financials/income/invoices/${pageId}`;
        case 'db-expenses': return `/admin/financials/expenses/invoices?open=${pageId}`;
        case 'db-quotations': return `/admin/quotations/${pageId}`;
        case 'db-payments-in': return `/admin/financials/income/payments?open=${pageId}`;
        case 'db-payments-out': return `/admin/financials/expenses/payments?open=${pageId}`;
        default:
            if (databaseId.startsWith('db-timesheets') || databaseId.startsWith('db-hr')) {
                return `/admin/hr/timesheets?open=${pageId}`;
            }
            if (databaseId.startsWith('db-inbox')) {
                return `/admin/email?open=${pageId}`;
            }
            if (databaseId.startsWith('db-journal')) {
                return `/admin/journal?open=${pageId}`;
            }
            return null;
    }
}
