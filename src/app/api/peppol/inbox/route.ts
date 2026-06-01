/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import {
    listInboxDocuments,
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
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true, lockedDbIds: true },
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

        // ── AUTOMATIC SERVER-SIDE DATABASE SYNC ─────────────────────────────────
        const { getLockedDbId } = await import('@/lib/lockedDbUtils');
        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const expensesDbId = getLockedDbId('db-expenses', lockedDbIds);

        // Ensure database exists
        const existingDb = await prisma.globalDatabase.findUnique({
            where: { id: expensesDbId },
            select: { id: true }
        });
        if (!existingDb) {
            await prisma.globalDatabase.create({
                data: {
                    id: expensesDbId,
                    tenantId,
                    name: 'db-expenses',
                    properties: [],
                    views: [],
                    activeFilters: [],
                    activeSorts: [],
                    isTemplate: false,
                    ownerId: 'system',
                }
            });
        }

        // Get existing Peppol document IDs
        const existingPages = await prisma.globalPage.findMany({
            where: { databaseId: expensesDbId },
            select: { properties: true }
        });
        const existingPeppolIds = new Set(
            existingPages
                .map(p => (p.properties as any)?.peppolDocId)
                .filter(Boolean)
                .map(String)
        );

        const { v4: uuidv4 } = await import('uuid');
        const { incrementPeppolReceived } = await import('@/lib/plan-limits');

        let newlyImportedCount = 0;
        const newlyImportedPages: any[] = [];

        for (const doc of parsedDocs) {
            if (existingPeppolIds.has(doc.id)) continue;

            const parsed = doc.parsed;
            if (!parsed) continue;

            // Get max order
            const maxOrderRow = await prisma.globalPage.findFirst({
                where: { databaseId: expensesDbId },
                orderBy: { order: 'desc' },
                select: { order: true }
            });
            const order = (maxOrderRow?.order ?? -1) + 1;

            const pageId = uuidv4();

            const saved = await prisma.globalPage.create({
                data: {
                    id: pageId,
                    databaseId: expensesDbId,
                    properties: {
                        title: parsed.invoiceNumber || doc.invoice_number || doc.id,
                        betreft: parsed.lines?.[0]?.description || '',
                        source: 'src-peppol',
                        status: 'opt-unpaid',
                        invoiceDate: parsed.issueDate || doc.issue_date || '',
                        dueDate: parsed.dueDate || doc.due_date || '',
                        totalExVat: parsed.totalExVat || 0,
                        totalVat: parsed.totalVat || 0,
                        totalIncVat: parsed.totalIncVat || doc.total_amount || 0,
                        peppolDocId: doc.id,
                        invoiceLines: JSON.stringify(parsed.lines || []),
                        supplierName: parsed.supplierName || doc.sender_name || '',
                        supplierVat: parsed.supplierVat || doc.sender_peppol_id || '',
                        supplier: doc.matchedSupplierId ? [doc.matchedSupplierId] : [],
                    },
                    order,
                    blocks: [],
                    createdBy: 'system',
                    lastEditedBy: 'system',
                }
            });

            // Increment the Peppol received quota counter
            await incrementPeppolReceived(tenantId);
            newlyImportedCount++;

            newlyImportedPages.push({
                id: saved.id,
                databaseId: saved.databaseId,
                properties: saved.properties as any,
                order: saved.order ?? 0,
                blocks: [],
                createdAt: saved.createdAt.toISOString(),
                updatedAt: saved.updatedAt.toISOString(),
                createdBy: saved.createdBy,
                lastEditedBy: saved.lastEditedBy,
            });
        }

        // Return updated document list, count, and pages
        return NextResponse.json({
            documents: parsedDocs,
            total: inbox.total,
            quota: quotaInfo,
            newlyImportedCount,
            newlyImportedPages,
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
        if (!session?.user?.tenantId) {
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
