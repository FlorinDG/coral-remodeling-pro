import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import {
    listInboxDocuments,
    getInboxDocument,
    acceptInboxDocument,
    rejectInboxDocument,
    parseUBLToInvoice,
} from '@/lib/e-invoice-inbox';

/**
 * GET /api/peppol/inbox
 * Lists all received Peppol documents for the current tenant.
 * Returns parsed data ready for the Purchase Invoices database.
 */
export async function GET() {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true },
        });

        if (!tenant?.eInvoiceApiKey) {
            return NextResponse.json({
                error: 'Peppol niet geconfigureerd. Ga naar Instellingen → Financials.',
                documents: [],
            }, { status: 400 });
        }

        const inbox = await listInboxDocuments(tenant.eInvoiceApiKey);

        // Parse each document into our internal format
        const parsedDocs = await Promise.all(
            (inbox.documents || []).map(async (doc) => {
                try {
                    // If inline UBL is available, parse it
                    if (doc.ubl_xml) {
                        const parsed = parseUBLToInvoice(doc.ubl_xml, doc.id);
                        return { ...doc, parsed };
                    }
                    // Otherwise return raw doc info
                    return {
                        ...doc,
                        parsed: {
                            invoiceNumber: doc.invoice_number || doc.id,
                            issueDate: doc.issue_date || '',
                            dueDate: doc.due_date || '',
                            supplierName: doc.sender_name || '',
                            supplierVat: doc.sender_peppol_id || '',
                            supplierAddress: '',
                            buyerName: '',
                            buyerVat: '',
                            currency: doc.currency || 'EUR',
                            lines: [],
                            totalExVat: 0,
                            totalVat: 0,
                            totalIncVat: doc.total_amount || 0,
                            peppolDocId: doc.id,
                            rawXml: '',
                        },
                    };
                } catch (parseErr) {
                    console.error(`[Peppol Inbox] Failed to parse doc ${doc.id}:`, parseErr);
                    return { ...doc, parsed: null, parseError: String(parseErr) };
                }
            })
        );

        return NextResponse.json({
            documents: parsedDocs,
            total: inbox.total,
        });

    } catch (error: any) {
        console.error('[Peppol Inbox] GET error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch inbox' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/peppol/inbox
 * Accepts or rejects a specific inbox document.
 * Body: { docId: string, action: 'accept' | 'reject' }
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true },
        });

        if (!tenant?.eInvoiceApiKey) {
            return NextResponse.json(
                { error: 'Peppol niet geconfigureerd.' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { docId, action } = body;

        if (!docId || !['accept', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'docId and action (accept/reject) required' },
                { status: 400 }
            );
        }

        if (action === 'accept') {
            await acceptInboxDocument(tenant.eInvoiceApiKey, docId);
        } else {
            await rejectInboxDocument(tenant.eInvoiceApiKey, docId);
        }

        return NextResponse.json({ success: true, action, docId });

    } catch (error: any) {
        console.error('[Peppol Inbox] POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Action failed' },
            { status: 500 }
        );
    }
}
