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
import {
    maybeResetMonthlyCounters,
    checkPeppolReceivedQuota,
} from '@/lib/plan-limits';

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
                error: 'PEPPOL_NOT_CONFIGURED',
                documents: [],
            }, { status: 400 });
        }

        const inbox = await listInboxDocuments(tenant.eInvoiceApiKey);

        // Reset monthly counters if needed, then check quota
        await maybeResetMonthlyCounters(tenantId);
        const quotaInfo = await checkPeppolReceivedQuota(tenantId);

        // Pre-load supplier contacts for auto-matching by VAT
        const suppliers = await prisma.supplier.findMany({
            where: { tenantId },
            select: { id: true, vatNumber: true },
        });
        const vatToSupplier = new Map<string, string>();
        suppliers.forEach((s) => {
            if (s.vatNumber) vatToSupplier.set(s.vatNumber.replace(/\s/g, '').toUpperCase(), s.id);
        });

        // Parse each document into our internal format
        // NOTE: We do NOT increment the received counter here — that happens
        // after deduplication on the client side via POST /api/peppol/inbox/count
        const parsedDocs = await Promise.all(
            (inbox.documents || []).map(async (doc) => {
                try {
                    // If inline UBL is available, parse it
                    if (doc.ubl_xml) {
                        const parsed = parseUBLToInvoice(doc.ubl_xml, doc.id);
                        return {
                            ...doc,
                            parsed,
                            matchedSupplierId: matchSupplier(parsed.supplierVat, vatToSupplier),
                        };
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
                        matchedSupplierId: matchSupplier(doc.sender_peppol_id, vatToSupplier),
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
            quota: quotaInfo,       // { overQuota, current, limit, plan }
        });

    } catch (error: any) {
        console.error('[Peppol Inbox] GET error:', error);
        return NextResponse.json(
            { error: error.message || 'INBOX_FETCH_FAILED' },
            { status: 500 }
        );
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function matchSupplier(vatOrPeppolId: string | undefined, vatMap: Map<string, string>): string | null {
    if (!vatOrPeppolId) return null;
    const normalized = vatOrPeppolId.replace(/\s/g, '').toUpperCase();
    return vatMap.get(normalized) || null;
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
                { error: 'PEPPOL_NOT_CONFIGURED' },
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
