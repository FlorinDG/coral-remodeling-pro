/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import {
    listInboxDocuments,
    listInboxInvoices,
    listInboxCreditNotes,
    acceptInboxDocument,
    rejectInboxDocument,
    InboxDocument,
} from '@/lib/e-invoice-inbox';
import {
    maybeResetMonthlyCounters,
    checkPeppolReceivedQuota,
} from '@/lib/plan-limits';

/**
 * GET /api/peppol/inbox
 * Lists all received Peppol documents for the current tenant.
 * Returns parsed data ready for the Purchase Invoices database.
 *
 * F3 FIX (2026-06-03): Response shape corrected — reads `.items` (not `.documents`),
 * maps real DocumentResponse fields, stops swallowing fetch errors.
 */
export async function GET(req: Request) {
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

        // ── Fetch all inbox endpoints — LOG errors, don't swallow them ──
        const fetchErrors: string[] = [];

        const [inboxPending, inboxInvoices, inboxCreditNotes] = await Promise.all([
            listInboxDocuments(tenant.eInvoiceApiKey).catch((err) => {
                console.error('[Peppol Inbox] listInboxDocuments FAILED:', err.message || err);
                fetchErrors.push(`inbox: ${err.message || 'unknown'}`);
                return { items: [], total: 0 } as const;
            }),
            listInboxInvoices(tenant.eInvoiceApiKey).catch((err) => {
                console.error('[Peppol Inbox] listInboxInvoices FAILED:', err.message || err);
                fetchErrors.push(`invoices: ${err.message || 'unknown'}`);
                return { items: [], total: 0 } as const;
            }),
            listInboxCreditNotes(tenant.eInvoiceApiKey).catch((err) => {
                console.error('[Peppol Inbox] listInboxCreditNotes FAILED:', err.message || err);
                fetchErrors.push(`credit-notes: ${err.message || 'unknown'}`);
                return { items: [], total: 0 } as const;
            }),
        ]);

        // ── F3-B/C: Debug mode — ?debug=1 returns raw API responses ──
        const url = new URL(req.url);
        if (url.searchParams.get('debug') === '1') {
            const BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';
            const maskedKey = tenant.eInvoiceApiKey.slice(0, 8) + '…' + tenant.eInvoiceApiKey.slice(-4);

            // Also fetch outbox to check if docs were sent/processed (not in inbox)
            let raw_outbox = null;
            try {
                const outRes = await fetch(`${BASE_URL}/api/outbox/?page=1&page_size=100`, {
                    headers: { 'Authorization': `Bearer ${tenant.eInvoiceApiKey}`, 'Content-Type': 'application/json' },
                });
                if (outRes.ok) raw_outbox = await outRes.json();
                else raw_outbox = { _error: `${outRes.status} ${outRes.statusText}` };
            } catch (e: any) {
                raw_outbox = { _error: e.message };
            }

            return NextResponse.json({
                _debug: true,
                _timestamp: new Date().toISOString(),
                _tenantId: tenantId,
                _baseUrl: BASE_URL,
                _apiKey: maskedKey,
                fetchErrors: fetchErrors.length > 0 ? fetchErrors : null,
                raw_inbox: inboxPending,
                raw_invoices: inboxInvoices,
                raw_creditNotes: inboxCreditNotes,
                raw_outbox,
            }, {
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
        }

        // ── Merge + deduplicate by document ID ──
        const docMap = new Map<string, InboxDocument>();
        [
            ...(inboxPending.items || []),
            ...(inboxInvoices.items || []),
            ...(inboxCreditNotes.items || []),
        ].forEach((d) => {
            if (d && d.id) docMap.set(d.id, d);
        });

        const uniqueDocuments = Array.from(docMap.values());
        const totalCount = uniqueDocuments.length;

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

        // ── Parse each DocumentResponse into our internal format ──
        // F3: Use structured data from DocumentResponse directly — no inline ubl_xml exists.
        const parsedDocs = uniqueDocuments.map((doc: InboxDocument) => {
            try {
                // Map real DocumentResponse fields → internal ParsedPurchaseInvoice shape
                const docType = doc.document_type === 'CREDIT_NOTE' ? 'credit_note' : 'invoice';
                const invoiceNumber = doc.invoice_id || doc.id;
                const issueDate = doc.invoice_date || '';
                const dueDate = doc.due_date || '';
                const vendorName = doc.vendor_name || '';
                const vendorVat = doc.vendor_tax_id || '';
                const vendorAddr = doc.vendor_address || '';
                const buyerName = doc.customer_name || '';
                const buyerVat = doc.customer_tax_id || '';
                const currency = doc.currency || 'EUR';
                const totalIncVat = parseFloat(doc.invoice_total || '0');
                const totalExVat = parseFloat(doc.subtotal || '0');
                const totalVat = parseFloat(doc.total_tax || '0');

                // Map line items from DocumentResponse.items[] → ParsedInvoiceLine[]
                const lines = (doc.items || []).map((item) => ({
                    description: item.description || '',
                    quantity: parseFloat(String(item.quantity || '1')),
                    unitCode: item.unit_code || 'C62',
                    unitPrice: parseFloat(String(item.unit_price || '0')),
                    vatRate: parseFloat(String(item.tax_rate || '0')),
                    lineTotal: parseFloat(String(item.amount || '0')),
                }));

                const parsed = {
                    invoiceNumber,
                    issueDate,
                    dueDate,
                    supplierName: vendorName,
                    supplierVat: vendorVat,
                    supplierAddress: vendorAddr,
                    buyerName,
                    buyerVat,
                    currency,
                    lines,
                    totalExVat,
                    totalVat,
                    totalIncVat,
                    peppolDocId: doc.id,
                    rawXml: '', // UBL XML is fetched separately if needed
                };

                return {
                    id: doc.id,
                    type: docType,
                    state: doc.state,
                    vendor_name: vendorName,
                    vendor_tax_id: vendorVat,
                    invoice_id: invoiceNumber,
                    invoice_date: issueDate,
                    due_date: dueDate,
                    invoice_total: doc.invoice_total,
                    currency,
                    parsed,
                    matchedSupplierId: matchSupplier(vendorVat, vatToSupplier),
                };
            } catch (parseErr) {
                console.error(`[Peppol Inbox] Failed to parse doc ${doc.id}:`, parseErr);
                return {
                    id: doc.id,
                    type: doc.document_type === 'CREDIT_NOTE' ? 'credit_note' : 'invoice',
                    state: doc.state,
                    vendor_name: doc.vendor_name,
                    invoice_id: doc.invoice_id,
                    parsed: null,
                    parseError: String(parseErr),
                    matchedSupplierId: null,
                };
            }
        });

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

        // Get existing Peppol document IDs to deduplicate
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
                        title: parsed.invoiceNumber || doc.id,
                        betreft: parsed.lines?.[0]?.description || '',
                        source: 'src-peppol',
                        status: 'opt-unpaid',
                        invoiceDate: parsed.issueDate || '',
                        dueDate: parsed.dueDate || '',
                        totalExVat: parsed.totalExVat || 0,
                        totalVat: parsed.totalVat || 0,
                        totalIncVat: parsed.totalIncVat || 0,
                        peppolDocId: doc.id,
                        invoiceLines: JSON.stringify(parsed.lines || []),
                        supplierName: parsed.supplierName || '',
                        supplierVat: parsed.supplierVat || '',
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

        // Return updated document list, count, pages, AND any fetch errors
        return NextResponse.json({
            documents: parsedDocs,
            total: totalCount,
            quota: quotaInfo,
            newlyImportedCount,
            newlyImportedPages,
            // F3: Surface fetch errors so the UI can distinguish "empty inbox" from "broken call"
            ...(fetchErrors.length > 0 ? { fetchErrors } : {}),
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
