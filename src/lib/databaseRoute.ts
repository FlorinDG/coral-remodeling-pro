export function getDatabaseRoute(databaseId: string, pageId: string): string {
    let cleanDbId = databaseId;
    if (databaseId.startsWith('db-clients')) cleanDbId = 'db-clients';
    else if (databaseId.startsWith('db-suppliers')) cleanDbId = 'db-suppliers';
    else if (databaseId.startsWith('db-articles')) cleanDbId = 'db-articles';
    else if (databaseId.startsWith('db-bestek')) cleanDbId = 'db-bestek';
    else if (databaseId.startsWith('db-crm')) cleanDbId = 'db-crm';
    else if (databaseId.startsWith('db-bobex')) cleanDbId = 'db-bobex';
    else if (databaseId.startsWith('db-tickets')) cleanDbId = 'db-tickets';
    else if (databaseId.startsWith('db-1')) cleanDbId = 'db-1';
    else if (databaseId.startsWith('db-tasks')) cleanDbId = 'db-tasks';
    else if (databaseId.startsWith('db-invoices')) cleanDbId = 'db-invoices';
    else if (databaseId.startsWith('db-quotations')) cleanDbId = 'db-quotations';

    switch (cleanDbId) {
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
        case 'db-quotations': return `/admin/quotations/${pageId}`;
        default: return `/admin/dynamic-db?open=${pageId}`;
    }
}
