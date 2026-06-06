import { redirect } from 'next/navigation';

interface Props {
    params: Promise<{ locale: string; databaseId: string; pageId: string }>;
}

export default async function DatabaseRecordPage({ params }: Props) {
    const { databaseId, pageId } = await params;
    
    // Determine the base database prefix/id to map to its parent module
    // Database IDs can have tenant suffix, e.g. "db-clients-cmneyas2"
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

    let parentPath = '';
    
    switch (cleanDbId) {
        case 'db-clients':
            parentPath = `/admin/contacts?open=${pageId}`;
            break;
        case 'db-suppliers':
            parentPath = `/admin/suppliers?open=${pageId}`;
            break;
        case 'db-articles':
            parentPath = `/admin/library/articles?open=${pageId}`;
            break;
        case 'db-bestek':
            parentPath = `/admin/library/bestek?open=${pageId}`;
            break;
        case 'db-crm':
        case 'db-bobex':
            parentPath = `/admin/crm?open=${pageId}`;
            break;
        case 'db-tickets':
            parentPath = `/admin/financials/expenses/tickets?open=${pageId}`;
            break;
        case 'db-1':
            parentPath = `/admin/projects-management?open=${pageId}`;
            break;
        case 'db-tasks':
            parentPath = `/admin/tasks?open=${pageId}`;
            break;
        case 'db-invoices':
            parentPath = `/admin/financials/income/invoices/${pageId}`;
            break;
        case 'db-quotations':
            parentPath = `/admin/quotations/${pageId}`;
            break;
        default:
            parentPath = `/admin/dynamic-db?open=${pageId}`;
            break;
    }

    redirect(parentPath);
}
