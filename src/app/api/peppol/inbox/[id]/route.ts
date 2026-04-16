import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getInboxDocument, parseUBLToInvoice } from '@/lib/e-invoice-inbox';

/**
 * GET /api/peppol/inbox/[id]
 * Returns full details of a specific inbox document including parsed UBL fields.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;
        const { id: docId } = await params;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true },
        });

        if (!tenant?.eInvoiceApiKey) {
            return NextResponse.json(
                { error: 'Peppol not configured' },
                { status: 400 }
            );
        }

        const doc = await getInboxDocument(tenant.eInvoiceApiKey, docId);

        let parsed = null;
        if (doc.ubl_xml) {
            parsed = parseUBLToInvoice(doc.ubl_xml, doc.id);
        }

        return NextResponse.json({
            document: doc,
            parsed,
        });

    } catch (error: any) {
        console.error('[Peppol Inbox Detail] error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get document' },
            { status: 500 }
        );
    }
}
