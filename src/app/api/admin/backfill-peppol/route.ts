import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getInboxDocument, getInboxDocumentPdf } from '@/lib/e-invoice-inbox';
import { getLockedDbId } from '@/lib/lockedDbUtils';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, findOrCreateFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow 5 minutes for backfill script

export async function GET(req: Request) {
    try {
        const session = await auth();
        // Guarded route: either logged in as admin/user of a tenant, or requires an admin key
        const url = new URL(req.url);
        const adminKey = url.searchParams.get('key');
        const isDryRun = url.searchParams.get('execute') !== '1';
        
        // Example check: if not using an admin key, require standard auth
        // Since it's a superadmin script, we allow a ?key=... to bypass normal auth for cron/CLI usage, 
        // or fallback to the logged-in user's tenant.
        let tenantId = '';
        if (adminKey === process.env.CRON_SECRET || adminKey === process.env.API_SECRET) {
            // Superadmin mode - could iterate all tenants, but for safety we require ?tenantId=...
            tenantId = url.searchParams.get('tenantId') || '';
            if (!tenantId) {
                return NextResponse.json({ error: 'tenantId required in superadmin mode' }, { status: 400 });
            }
        } else if (session?.user && (session.user as any).tenantId) {
            tenantId = (session.user as any).tenantId;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true, lockedDbIds: true, driveFolderId: true },
        });

        if (!tenant || !tenant.eInvoiceApiKey) {
            return NextResponse.json({ error: 'Tenant not found or PEPPOL not configured' }, { status: 400 });
        }

        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const expensesDbId = getLockedDbId('db-expenses', lockedDbIds);

        // Fetch all peppol expense pages
        const pages = await prisma.globalPage.findMany({
            where: { databaseId: expensesDbId },
            select: { id: true, properties: true, blocks: true },
        });

        const pagesToUpdate = pages.filter(page => {
            const props = page.properties as any;
            if (props.source !== 'src-peppol' && !props.peppolDocId) return false;
            if (!props.peppolDocId) return false;

            // Check if missing data: empty supplier, no receiptUrl, or empty blocks
            const hasSupplier = Array.isArray(props.supplier) && props.supplier.length > 0;
            const hasReceiptUrl = !!props.receiptUrl;
            const hasBlocks = Array.isArray(page.blocks) && page.blocks.length > 0;

            return (!hasSupplier || !hasReceiptUrl || !hasBlocks);
        });

        if (isDryRun) {
            return NextResponse.json({
                message: 'DRY RUN MODE. Pass ?execute=1 to apply changes.',
                tenantId,
                totalPeppolExpenses: pages.length,
                recordsToBackfill: pagesToUpdate.length,
                sample: pagesToUpdate.slice(0, 3).map(p => ({
                    id: p.id,
                    peppolDocId: (p.properties as any).peppolDocId,
                    missingSupplier: !(Array.isArray((p.properties as any).supplier) && (p.properties as any).supplier.length > 0),
                    missingReceiptUrl: !(p.properties as any).receiptUrl,
                    missingBlocks: !(Array.isArray(p.blocks) && p.blocks.length > 0),
                }))
            });
        }

        let updatedCount = 0;
        const errors: any[] = [];

        // Pre-load suppliers for matching from db-suppliers
        const suppliersDbId = getLockedDbId('db-suppliers', lockedDbIds);
        const suppliers = await prisma.globalPage.findMany({
            where: { databaseId: suppliersDbId },
            select: { id: true, properties: true },
        });
        const vatToSupplier = new Map<string, string>();
        suppliers.forEach((s) => {
            const vat = (s.properties as any)?.vatNumber || (s.properties as any)?.vat;
            if (vat) vatToSupplier.set(String(vat).replace(/\s/g, '').toUpperCase(), s.id);
        });

        for (const page of pagesToUpdate) {
            try {
                const props = page.properties as any;
                const docId = props.peppolDocId;

                // Re-fetch the doc
                const rawDoc = await getInboxDocument(tenant.eInvoiceApiKey, docId).catch(err => {
                    console.error(`Failed to fetch doc ${docId}:`, err);
                    return null;
                });

                if (!rawDoc) {
                    errors.push({ id: page.id, docId, error: 'Could not fetch from Peppol API' });
                    continue;
                }

                let isDirty = false;
                const updateData: any = { properties: { ...props } };

                // Parse document fields
                const vendorName = rawDoc.vendor_name || '';
                const vendorVat = rawDoc.vendor_tax_id || '';
                const vendorAddr = rawDoc.vendor_address || '';

                // A) Auto-create + link supplier (GlobalPage in db-suppliers)
                const hasSupplier = Array.isArray(props.supplier) && props.supplier.length > 0;
                if (!hasSupplier && (vendorName || vendorVat)) {
                    let matchedSupplierId = null;
                    const safeVat = vendorVat.replace(/\s/g, '').toUpperCase();
                    if (safeVat && vatToSupplier.has(safeVat)) {
                        matchedSupplierId = vatToSupplier.get(safeVat) ?? null;
                    } else {
                        // Create db-suppliers GlobalPage
                        const newSupplierId = uuidv4();
                        
                        // Get max order
                        const maxOrderRow = await prisma.globalPage.findFirst({
                            where: { databaseId: suppliersDbId },
                            orderBy: { order: 'desc' },
                            select: { order: true }
                        });
                        const order = (maxOrderRow?.order ?? -1) + 1;
                        
                        const newSupplier = await prisma.globalPage.create({
                            data: {
                                id: newSupplierId,
                                databaseId: suppliersDbId,
                                order,
                                properties: {
                                    title: vendorName || 'Unknown Supplier',
                                    vatNumber: safeVat || null,
                                    address: vendorAddr || '',
                                },
                                createdBy: 'system',
                                lastEditedBy: 'system',
                            }
                        });
                        matchedSupplierId = newSupplier.id;
                        if (safeVat) vatToSupplier.set(safeVat, newSupplier.id);
                    }

                    if (matchedSupplierId) {
                        updateData.properties.supplier = [matchedSupplierId];
                        updateData.properties.supplierName = vendorName;
                        updateData.properties.supplierVat = vendorVat;
                        isDirty = true;
                    }
                }

                // B) Fetch original PDF -> store -> set receiptUrl
                if (!props.receiptUrl) {
                    if (tenant.driveFolderId && process.env.GOOGLE_CLIENT_ID) {
                        try {
                            const pdfBuffer = await getInboxDocumentPdf(tenant.eInvoiceApiKey, docId);
                            const expensesFolder = await findOrCreateFolder('Aankopen', tenant.driveFolderId);
                            const fileName = `Peppol_${rawDoc.invoice_id || docId}.pdf`;
                            const fileId = await uploadFile(fileName, 'application/pdf', pdfBuffer, expensesFolder, tenantId);
                            updateData.properties.receiptUrl = `https://drive.google.com/file/d/${fileId}/view`;
                            isDirty = true;
                        } catch (pdfErr) {
                            console.error(`[Backfill] Failed to fetch or upload PDF for ${docId}`, pdfErr);
                            errors.push({ id: page.id, docId, error: 'Failed to upload PDF to Drive' });
                        }
                    }
                }

                // C) Rebuild structured blocks
                const hasBlocks = Array.isArray(page.blocks) && page.blocks.length > 0;
                if (!hasBlocks && Array.isArray(rawDoc.items) && rawDoc.items.length > 0) {
                    const blocks = rawDoc.items.map((line: any, idx: number) => ({
                        id: uuidv4(),
                        type: 'financial-row',
                        content: line.description || '',
                        order: idx,
                        properties: {
                            quantity: parseFloat(String(line.quantity || '1')),
                            unitCode: line.unit_code || 'C62',
                            unitPrice: parseFloat(String(line.unit_price || '0')),
                            vatRate: parseFloat(String(line.tax_rate || '0')),
                            lineTotal: parseFloat(String(line.amount || '0')),
                            margePercent: 0,
                        }
                    }));
                    updateData.blocks = blocks;
                    isDirty = true;
                }

                if (isDirty) {
                    await prisma.globalPage.update({
                        where: { id: page.id },
                        data: updateData,
                    });
                    updatedCount++;
                }

            } catch (err: any) {
                console.error(`[Backfill] Error processing page ${page.id}:`, err);
                errors.push({ id: page.id, error: String(err.message || err) });
            }
        }

        return NextResponse.json({
            message: 'BACKFILL COMPLETE',
            tenantId,
            updatedCount,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error: any) {
        console.error('[Backfill Route] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
