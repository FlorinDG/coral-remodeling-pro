import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// All tenant profile fields that can be read and written
const TENANT_FIELDS = [
    'companyName', 'vatNumber', 'iban', 'logoUrl', 'peppolId', 'peppolRegistered', 'peppolOptOut', 'email',
    'street', 'postalCode', 'city', 'commercialName', 'bic',
    'deliveryStreet', 'deliveryPostalCode', 'deliveryCity',
    'headquartersStreet', 'headquartersPostalCode', 'headquartersCity',
    'directorFirstName', 'directorLastName', 'documentLanguage', 'brandColor',
    // Document numbering
    'invoicePrefix', 'invoiceConnector', 'invoiceDateFormat', 'invoiceNumberWidth', 'invoiceNextNumber',
    'quotationPrefix', 'quotationConnector', 'quotationDateFormat', 'quotationNumberWidth', 'quotationNextNumber',
    // Document template
    'documentTemplate',
    'documentMode',
    'stationeryUrl',
    // Module settings
    'defaultVatRate', 'vatCalcMode', 'defaultPaymentTermDays',
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
        const tenantId = (session?.user as any)?.tenantId;

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
        const tenantId = (session?.user as any)?.tenantId;

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

        // Also sync the user's environmentLanguage when documentLanguage changes
        const userId = (session?.user as any)?.id;
        if (data.documentLanguage && userId) {
            await prisma.user.update({
                where: { id: userId },
                data: { environmentLanguage: data.documentLanguage }
            });
        }

        const response = NextResponse.json(updatedTenant);

        // Set the NEXT_LOCALE cookie so next-intl middleware respects the preference
        // This ensures locale consistency across all subsequent requests
        if (data.documentLanguage) {
            response.cookies.set('NEXT_LOCALE', data.documentLanguage, {
                path: '/',
                maxAge: 365 * 24 * 60 * 60, // 1 year
                sameSite: 'lax',
            });
        }

        return response;
    } catch (error) {
        console.error('Error updating tenant profile:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH is an alias for PUT — module settings pages use PATCH
export { PUT as PATCH };
