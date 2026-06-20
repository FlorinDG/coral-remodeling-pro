import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { get as vercelBlobGet } from '@vercel/blob';
import JSZip from 'jszip';

export const runtime = 'nodejs';

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return Buffer.from(result.buffer);
}

async function fetchBlobFile(key: string): Promise<Buffer | null> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return null;
    try {
        const result = await vercelBlobGet(key, { token, access: 'private' });
        if (result && result.stream) {
            return await streamToBuffer(result.stream as any);
        }
        return null;
    } catch (e) {
        console.error(`Failed to fetch blob for key: ${key}`, e);
        return null;
    }
}

function cleanFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function calculateVatSplit(page: any) {
    const split = {
        base21: 0, vat21: 0,
        base12: 0, vat12: 0,
        base6: 0, vat6: 0,
        base0: 0, vat0: 0,
    };

    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const lines = blocks.filter((b: any) => b.type === 'financial-row');

    if (lines.length > 0) {
        lines.forEach((line: any) => {
            const base = parseFloat(String(line.properties?.lineTotal || 0));
            const rate = parseFloat(String(line.properties?.vatRate || 0));
            const vat = base * (rate / 100);

            if (Math.abs(rate - 21) < 0.5) {
                split.base21 += base;
                split.vat21 += vat;
            } else if (Math.abs(rate - 12) < 0.5) {
                split.base12 += base;
                split.vat12 += vat;
            } else if (Math.abs(rate - 6) < 0.5) {
                split.base6 += base;
                split.vat6 += vat;
            } else if (rate === 0) {
                split.base0 += base;
                split.vat0 += vat;
            } else {
                // Fallback: put under 21%
                split.base21 += base;
                split.vat21 += vat;
            }
        });
    } else {
        const totalEx = parseFloat(String(page.properties?.totalExVat || 0));
        const totalVat = parseFloat(String(page.properties?.totalVat || 0));
        
        if (totalEx !== 0) {
            const ratio = totalVat / totalEx;
            if (Math.abs(ratio - 0.21) < 0.05) {
                split.base21 = totalEx;
                split.vat21 = totalVat;
            } else if (Math.abs(ratio - 0.12) < 0.05) {
                split.base12 = totalEx;
                split.vat12 = totalVat;
            } else if (Math.abs(ratio - 0.06) < 0.05) {
                split.base6 = totalEx;
                split.vat6 = totalVat;
            } else {
                if (totalVat === 0) {
                    split.base0 = totalEx;
                    split.vat0 = 0;
                } else {
                    split.base21 = totalEx;
                    split.vat21 = totalVat;
                }
            }
        }
    }

    // Round to 2 decimals
    for (const key of Object.keys(split) as Array<keyof typeof split>) {
        split[key] = Math.round(split[key] * 100) / 100;
    }

    return split;
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session.user as any).tenantId;

        const url = new URL(req.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { lockedDbIds: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const { getLockedDbId } = await import('@/lib/lockedDbUtils');
        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const invoicesDbId = getLockedDbId('db-invoices', lockedDbIds);
        const expensesDbId = getLockedDbId('db-expenses', lockedDbIds);
        const clientsDbId = getLockedDbId('db-clients', lockedDbIds);
        const suppliersDbId = getLockedDbId('db-suppliers', lockedDbIds);

        // Fetch database pages
        const [invoices, expenses, clients, suppliers] = await Promise.all([
            prisma.globalPage.findMany({ where: { databaseId: invoicesDbId } }),
            prisma.globalPage.findMany({ where: { databaseId: expensesDbId } }),
            prisma.globalPage.findMany({ where: { databaseId: clientsDbId } }),
            prisma.globalPage.findMany({ where: { databaseId: suppliersDbId } }),
        ]);

        const clientMap = new Map(clients.map(c => [c.id, c]));
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));

        // Filter by date range in memory
        const filteredInvoices = invoices.filter(page => {
            const dateStr = (page.properties as any)?.invoiceDate;
            if (!dateStr) return false;
            return dateStr >= startDate && dateStr <= endDate;
        });

        const filteredExpenses = expenses.filter(page => {
            const dateStr = (page.properties as any)?.invoiceDate;
            if (!dateStr) return false;
            return dateStr >= startDate && dateStr <= endDate;
        });

        // Resolve helpers
        const getClientName = (page: any) => {
            const rel = page.properties.client;
            if (Array.isArray(rel) && rel.length > 0) {
                const c = clientMap.get(rel[0]);
                return (c?.properties as any)?.title || (c?.properties as any)?.company || 'Onbekende Klant';
            }
            return 'Onbekende Klant';
        };

        const getClientVat = (page: any) => {
            const rel = page.properties.client;
            if (Array.isArray(rel) && rel.length > 0) {
                const c = clientMap.get(rel[0]);
                return (c?.properties as any)?.vatNumber || (c?.properties as any)?.vat || '';
            }
            return '';
        };

        const getSupplierName = (page: any) => {
            const rel = page.properties.supplier;
            if (Array.isArray(rel) && rel.length > 0) {
                const s = supplierMap.get(rel[0]);
                return (s?.properties as any)?.title || (s?.properties as any)?.company || 'Onbekende Leverancier';
            }
            return (page.properties as any)?.supplierName || 'Onbekende Leverancier';
        };

        const getSupplierVat = (page: any) => {
            const rel = page.properties.supplier;
            if (Array.isArray(rel) && rel.length > 0) {
                const s = supplierMap.get(rel[0]);
                return (s?.properties as any)?.vatNumber || (s?.properties as any)?.vat || '';
            }
            return (page.properties as any)?.supplierVat || '';
        };

        // 1. Sales CSV (Verkoopdagboek)
        const salesHeaders = [
            "Factuurnummer",
            "Factuurdatum",
            "Klantnaam",
            "Klant BTW",
            "Omschrijving",
            "Totaal Excl BTW",
            "Totaal BTW",
            "Totaal Incl BTW",
            "Basis 21%",
            "BTW 21%",
            "Basis 12%",
            "BTW 12%",
            "Basis 6%",
            "BTW 6%",
            "Basis 0%",
            "BTW 0%"
        ];
        let salesRows = [salesHeaders.join(';')];
        for (const inv of filteredInvoices) {
            const props = (inv.properties as any) || {};
            const split = calculateVatSplit(inv);
            const row = [
                props.title || '',
                props.invoiceDate || '',
                `"${getClientName(inv).replace(/"/g, '""')}"`,
                getClientVat(inv),
                `"${(props.betreft || '').replace(/"/g, '""')}"`,
                props.totalExVat || 0,
                props.totalVat || 0,
                props.totalIncVat || 0,
                split.base21,
                split.vat21,
                split.base12,
                split.vat12,
                split.base6,
                split.vat6,
                split.base0,
                split.vat0
            ];
            salesRows.push(row.join(';'));
        }
        const salesCsv = '\uFEFF' + salesRows.join('\r\n');

        // 2. Purchases CSV (Aankoopdagboek)
        const purchasesHeaders = [
            "Factuurnummer",
            "Factuurdatum",
            "Leveranciernaam",
            "Leverancier BTW",
            "Omschrijving",
            "Munteenheid",
            "BTW-regime",
            "Categorie",
            "Grootboekrekening",
            "Betaalwijze",
            "Betaaldatum",
            "Totaal Excl BTW",
            "Totaal BTW",
            "Totaal Incl BTW",
            "Basis 21%",
            "BTW 21%",
            "Basis 12%",
            "BTW 12%",
            "Basis 6%",
            "BTW 6%",
            "Basis 0%",
            "BTW 0%"
        ];
        let purchasesRows = [purchasesHeaders.join(';')];
        for (const exp of filteredExpenses) {
            const props = (exp.properties as any) || {};
            const split = calculateVatSplit(exp);
            const row = [
                props.title || '',
                props.invoiceDate || '',
                `"${getSupplierName(exp).replace(/"/g, '""')}"`,
                getSupplierVat(exp),
                `"${(props.betreft || '').replace(/"/g, '""')}"`,
                props.currency || 'EUR',
                props.vatRegime || '',
                props.category || '',
                props.ledgerAccount || '',
                props.paymentMethod || '',
                props.paidDate || '',
                props.totalExVat || 0,
                props.totalVat || 0,
                props.totalIncVat || 0,
                split.base21,
                split.vat21,
                split.base12,
                split.vat12,
                split.base6,
                split.vat6,
                split.base0,
                split.vat0
            ];
            purchasesRows.push(row.join(';'));
        }
        const purchasesCsv = '\uFEFF' + purchasesRows.join('\r\n');

        // 3. Zip files using JSZip
        const zip = new JSZip();
        const periodStr = `${startDate}_tot_${endDate}`;
        zip.file(`verkoopdagboek_${periodStr}.csv`, salesCsv);
        zip.file(`aankoopdagboek_${periodStr}.csv`, purchasesCsv);

        const pdfFolder = zip.folder('documenten');

        // Fetch & add sales PDFs (if any)
        for (const inv of filteredInvoices) {
            const receiptUrl = (inv.properties as any)?.receiptUrl;
            if (receiptUrl) {
                const fileData = await fetchBlobFile(receiptUrl);
                if (fileData) {
                    const clientName = getClientName(inv);
                    const invNum = (inv.properties as any)?.title || inv.id;
                    const fileName = cleanFileName(`verkoop_${invNum}_${clientName}.pdf`);
                    pdfFolder?.file(fileName, fileData);
                }
            }
        }

        // Fetch & add purchases PDFs
        for (const exp of filteredExpenses) {
            const receiptUrl = (exp.properties as any)?.receiptUrl;
            if (receiptUrl) {
                const fileData = await fetchBlobFile(receiptUrl);
                if (fileData) {
                    const supplierName = getSupplierName(exp);
                    const invNum = (exp.properties as any)?.title || exp.id;
                    const fileName = cleanFileName(`aankoop_${invNum}_${supplierName}.pdf`);
                    pdfFolder?.file(fileName, fileData);
                }
            }
        }

        // 4. Update the accountantExportedAt property to true for flagged records
        for (const inv of filteredInvoices) {
            const props = (inv.properties as any) || {};
            props.accountantExportedAt = true;
            await prisma.globalPage.update({
                where: { id: inv.id },
                data: { properties: props }
            });
        }

        for (const exp of filteredExpenses) {
            const props = (exp.properties as any) || {};
            props.accountantExportedAt = true;
            await prisma.globalPage.update({
                where: { id: exp.id },
                data: { properties: props }
            });
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="boekhouding_export_${periodStr}.zip"`,
            }
        });

    } catch (e: any) {
        console.error('Accountant export failed:', e);
        return NextResponse.json({ error: e.message || 'Export failed' }, { status: 500 });
    }
}
