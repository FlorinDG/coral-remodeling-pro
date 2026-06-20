/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { storage } from '@/lib/storage';
import prisma from '@/lib/prisma';
import {
    listInboxDocuments,
    listInboxInvoices,
    listInboxCreditNotes,
    getDocumentUbl,
    getDocumentSupplierPdf,
    parseUBLToInvoice,
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
            select: { eInvoiceApiKey: true, lockedDbIds: true, driveFolderId: true },
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

        const { getLockedDbId } = await import('@/lib/lockedDbUtils');
        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const suppliersDbId = getLockedDbId('db-suppliers', lockedDbIds);

        // Pre-load supplier contacts for auto-matching by VAT
        const suppliers = await prisma.globalPage.findMany({
            where: { databaseId: suppliersDbId },
            select: { id: true, properties: true },
        });
        const vatToSupplier = new Map<string, string>();
        suppliers.forEach((s) => {
            const vat = (s.properties as any)?.vatNumber || (s.properties as any)?.vat;
            if (vat) vatToSupplier.set(String(vat).replace(/\s/g, '').toUpperCase(), s.id);
        });

        // ── Parse each DocumentResponse into our internal format ──
        // C2: For each doc, try to fetch and parse the full UBL for rich data.
        // Falls back to the sparse inbox-list fields if UBL is unavailable.
        const parsedDocs = [];
        for (const doc of uniqueDocuments) {
            try {
                const docType = doc.document_type === 'CREDIT_NOTE' ? 'credit_note' : 'invoice';

                // Try to get the full UBL and parse it for rich data
                let parsed: any = null;
                const ublXml = await getDocumentUbl(tenant.eInvoiceApiKey, doc.id);
                if (ublXml) {
                    try {
                        parsed = parseUBLToInvoice(ublXml, doc.id);
                    } catch (ublErr) {
                        console.warn(`[Peppol Inbox] UBL parse failed for ${doc.id}, falling back to sparse data:`, ublErr);
                    }
                }

                // Fallback: use the sparse inbox-list fields
                if (!parsed) {
                    const lines = (doc.items || []).map((item) => ({
                        description: item.description || '',
                        quantity: parseFloat(String(item.quantity || '1')),
                        unitCode: item.unit_code || 'C62',
                        unitPrice: parseFloat(String(item.unit_price || '0')),
                        vatRate: parseFloat(String(item.tax_rate || '0')),
                        lineTotal: parseFloat(String(item.amount || '0')),
                    }));

                    parsed = {
                        invoiceNumber: doc.invoice_id || doc.id,
                        issueDate: doc.invoice_date || '',
                        dueDate: doc.due_date || '',
                        supplierName: doc.vendor_name || '',
                        supplierVat: doc.vendor_tax_id || '',
                        supplierAddress: doc.vendor_address || '',
                        buyerName: doc.customer_name || '',
                        buyerVat: doc.customer_tax_id || '',
                        currency: doc.currency || 'EUR',
                        lines,
                        totalExVat: parseFloat(doc.subtotal || '0'),
                        totalVat: parseFloat(doc.total_tax || '0'),
                        totalIncVat: parseFloat(doc.invoice_total || '0'),
                        peppolDocId: doc.id,
                        rawXml: '',
                    };
                }

                parsedDocs.push({
                    id: doc.id,
                    type: docType,
                    state: doc.state,
                    vendor_name: parsed.supplierName,
                    vendor_tax_id: parsed.supplierVat,
                    invoice_id: parsed.invoiceNumber,
                    invoice_date: parsed.issueDate,
                    due_date: parsed.dueDate,
                    invoice_total: String(parsed.totalIncVat),
                    currency: parsed.currency,
                    parsed,
                    matchedSupplierId: matchSupplier(parsed.supplierVat, vatToSupplier),
                });
            } catch (parseErr) {
                console.error(`[Peppol Inbox] Failed to parse doc ${doc.id}:`, parseErr);
                parsedDocs.push({
                    id: doc.id,
                    type: doc.document_type === 'CREDIT_NOTE' ? 'credit_note' : 'invoice',
                    state: doc.state,
                    vendor_name: doc.vendor_name,
                    invoice_id: doc.invoice_id,
                    parsed: null,
                    parseError: String(parseErr),
                    matchedSupplierId: null,
                });
            }
        }

        // ── AUTOMATIC SERVER-SIDE DATABASE SYNC ─────────────────────────────────
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

            // 1. Supplier Auto-creation (GlobalPage in db-suppliers)
            let matchedSupplierId = doc.matchedSupplierId;
            if (!matchedSupplierId && (parsed.supplierName || parsed.supplierVat)) {
                const safeVat = (parsed.supplierVat || '').replace(/\s/g, '').toUpperCase();
                try {
                    if (safeVat && vatToSupplier.has(safeVat)) {
                        matchedSupplierId = vatToSupplier.get(safeVat) ?? null;
                    } else {
                        // Create db-suppliers GlobalPage
                        const { v4: uuidv4 } = await import('uuid');
                        const newSupplierId = uuidv4();
                        
                        // Get max order
                        const maxOrderRow = await prisma.globalPage.findFirst({
                            where: { databaseId: suppliersDbId },
                            orderBy: { order: 'desc' },
                            select: { order: true }
                        });
                        const order = (maxOrderRow?.order ?? -1) + 1;
                        
                        const supplier = await prisma.globalPage.create({
                            data: {
                                id: newSupplierId,
                                databaseId: suppliersDbId,
                                order,
                                properties: {
                                    title: parsed.supplierName || 'Unknown Supplier',
                                    vatNumber: safeVat || null,
                                    vat: safeVat || null,
                                    address: parsed.supplierAddress || '',
                                    email: parsed.supplierContact?.email || '',
                                    phone: parsed.supplierContact?.phone || '',
                                    contact_person: parsed.supplierContact?.name || '',
                                    city: parsed.supplierCity || '',
                                    postal: parsed.supplierPostal || '',
                                    country: parsed.supplierCountry || '',
                                },
                                createdBy: 'system',
                                lastEditedBy: 'system',
                            }
                        });
                        if (safeVat) vatToSupplier.set(safeVat, supplier.id);
                        matchedSupplierId = supplier.id;
                    }
                } catch(e) {
                    console.error('[Peppol AutoCreateSupplier]', e);
                }
            }

            const pageId = uuidv4();

            // 2. Fetch supplier PDF attachment and store in Blob
            let receiptUrl = '';
            try {
                const pdfResult = await getDocumentSupplierPdf(tenant.eInvoiceApiKey, doc.id);
                if (pdfResult) {
                    const safeName = pdfResult.fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                    const key = `t_${tenantId}/purchase-invoice/${pageId}/${safeName}`;
                    const result = await storage.put(key, pdfResult.buffer, { contentType: 'application/pdf' });
                    receiptUrl = result.key;
                }
            } catch (pdfErr) {
                console.error('[Peppol Inbox] Failed to fetch or upload PDF for doc', doc.id, pdfErr);
            }

            // 3. Structured Line Items
            const blocks = (parsed.lines || []).map((line: any, idx: number) => ({
                id: uuidv4(),
                type: 'financial-row',
                content: line.description || '',
                order: idx,
                properties: {
                    quantity: line.quantity ?? 1,
                    unitCode: line.unitCode ?? 'C62',
                    unitPrice: line.unitPrice ?? 0,
                    vatRate: line.vatRate ?? 0,
                    lineTotal: line.lineTotal ?? 0,
                    margePercent: 0,
                }
            }));

            // Get max order
            const maxOrderRow = await prisma.globalPage.findFirst({
                where: { databaseId: expensesDbId },
                orderBy: { order: 'desc' },
                select: { order: true }
            });
            const order = (maxOrderRow?.order ?? -1) + 1;

            const saved = await prisma.globalPage.create({
                data: {
                    id: pageId,
                    databaseId: expensesDbId,
                    properties: {
                        title: parsed.invoiceNumber || doc.id,
                        betreft: parsed.betreft || '',
                        ogm: parsed.ogm || '',
                        contact: parsed.supplierContact 
                            ? [parsed.supplierContact.name, parsed.supplierContact.phone, parsed.supplierContact.email].filter(Boolean).join(' / ') 
                            : '',
                        source: 'src-peppol',
                        docType: doc.type === 'credit_note' ? 'opt-credit-note' : 'opt-invoice',
                        status: 'opt-unpaid',
                        invoiceDate: parsed.issueDate || '',
                        dueDate: parsed.dueDate || '',
                        totalExVat: doc.type === 'credit_note' ? -Math.abs(parsed.totalExVat || 0) : (parsed.totalExVat || 0),
                        totalVat: doc.type === 'credit_note' ? -Math.abs(parsed.totalVat || 0) : (parsed.totalVat || 0),
                        totalIncVat: doc.type === 'credit_note' ? -Math.abs(parsed.totalIncVat || 0) : (parsed.totalIncVat || 0),
                        peppolDocId: doc.id,
                        invoiceLines: JSON.stringify(parsed.lines || []),
                        supplierName: parsed.supplierName || '',
                        supplierVat: parsed.supplierVat || '',
                        supplier: matchedSupplierId ? [matchedSupplierId] : [],
                        receiptUrl,
                    },
                    order,
                    blocks,
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
