import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// All tenant profile fields that can be read and written
const TENANT_FIELDS = [
    'companyName', 'vatNumber', 'iban', 'logoUrl', 'peppolId', 'peppolRegistered', 'peppolOptOut', 'email',
    'peppolSentThisMonth', 'peppolReceivedThisMonth',
    'street', 'postalCode', 'city', 'commercialName', 'bic',
    'deliveryStreet', 'deliveryPostalCode', 'deliveryCity',
    'headquartersStreet', 'headquartersPostalCode', 'headquartersCity',
    'directorFirstName', 'directorLastName', 'documentLanguage', 'brandColor',
    // Document numbering
    'invoicePrefix', 'invoiceConnector', 'invoiceDateFormat', 'invoiceNumberWidth', 'invoiceNextNumber',
    'quotationPrefix', 'quotationConnector', 'quotationDateFormat', 'quotationNumberWidth', 'quotationNextNumber',
    'creditnotePrefix', 'creditnoteConnector', 'creditnoteDateFormat', 'creditnoteNumberWidth', 'creditnoteNextNumber',
    // Scan quotas
    'scanCount', 'scanQuota',
    // Document template
    'documentTemplate',
    'documentMode',
    'stationeryUrl',
    'documentFont',
    'documentFontSize',
    // Module settings
    'defaultVatRate', 'vatCalcMode', 'defaultPaymentTermDays',
    'defaultPaymentMethod', 'defaultPaymentDueModel', 'defaultPaymentLateClauseNL', 'defaultPaymentLateClauseFR',
    'defaultEventDuration', 'defaultCalendarView',
    'workHoursPerDay',
    'bordereauPrefix', 'poPrefix',
];

// Build a select object from field list + extras
function buildSelect() {
    const select: Record<string, boolean> = { id: true, planType: true };
    for (const f of TENANT_FIELDS) select[f] = true;
    return select;
}

export async function GET() {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: buildSelect()
        });

        if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

        return NextResponse.json(tenant);
    } catch (error) {
        console.error('Error fetching tenant profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Only include fields that are explicitly provided in the request body
        const data: Record<string, any> = {};
        for (const field of TENANT_FIELDS) {
            if (field in body) {
                data[field] = body[field];
            }
        }

        const updatedTenant = await (prisma.tenant as any).update({
            where: { id: tenantId },
            data,
            select: buildSelect()
        });

        revalidatePath('/', 'layout');

        const response = NextResponse.json(updatedTenant);

        return response;
    } catch (error) {
        console.error('Error updating tenant profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH is an alias for PUT — module settings pages use PATCH
export { PUT as PATCH };
