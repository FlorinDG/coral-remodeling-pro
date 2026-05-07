import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    const session = await auth();
    if (!(session?.user as any)?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session?.user as any).tenantId;
    const body = await req.json();

    if (!body.agree) {
        return NextResponse.json({ error: 'Terms not accepted' }, { status: 400 });
    }

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { vatNumber: true, companyName: true, email: true, peppolRegistered: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        if (tenant.peppolRegistered) {
            return NextResponse.json({ success: true, message: 'Already registered' });
        }

        if (!tenant.vatNumber) {
            return NextResponse.json({ error: 'VAT number is required for Peppol registration. Please update your Company Info first.' }, { status: 400 });
        }

        // Logic for e-invoice.be production onboarding
        // 1. In a real scenario, we would call the e-invoice.be API here to register the tenant.
        // 2. For now, we simulate success and mark as registered in our DB.
        
        const peppolId = `0190:${tenant.vatNumber.replace(/[^0-9]/g, '')}`;

        await prisma.tenant.update({
            where: { id: tenantId },
            data: {
                peppolRegistered: true,
                peppolId: peppolId,
                // Simulate generating an internal API key for Peppol documents if needed
                eInvoiceApiKey: `prod_key_${Math.random().toString(36).substring(2)}`
            }
        });

        return NextResponse.json({ success: true, peppolId });

    } catch (error) {
        console.error('[PEPPOL_REGISTER_ERROR]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
