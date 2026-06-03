/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getInboxDocument } from '@/lib/e-invoice-inbox';

/**
 * GET /api/peppol/inbox/[id]
 * Returns full details of a specific inbox document.
 * F3 FIX: Uses structured DocumentResponse fields directly — ubl_xml is NOT inline.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
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

        // F3: Extract structured fields from DocumentResponse (no inline UBL)
        const parsed = {
            invoiceNumber: doc.invoice_id || doc.id,
            issueDate: doc.invoice_date || '',
            dueDate: doc.due_date || '',
            supplierName: doc.vendor_name || '',
            supplierVat: doc.vendor_tax_id || '',
            supplierAddress: doc.vendor_address || '',
            buyerName: doc.customer_name || '',
            buyerVat: doc.customer_tax_id || '',
            currency: doc.currency || 'EUR',
            lines: (doc.items || []).map((item: any) => ({
                description: item.description || '',
                quantity: parseFloat(String(item.quantity || '1')),
                unitCode: item.unit_code || 'C62',
                unitPrice: parseFloat(String(item.unit_price || '0')),
                vatRate: parseFloat(String(item.tax_rate || '0')),
                lineTotal: parseFloat(String(item.amount || '0')),
            })),
            totalExVat: parseFloat(doc.subtotal || '0'),
            totalVat: parseFloat(doc.total_tax || '0'),
            totalIncVat: parseFloat(doc.invoice_total || '0'),
            peppolDocId: doc.id,
            rawXml: '',
        };

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
