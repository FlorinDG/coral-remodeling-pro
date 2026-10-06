import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { scopeFromSession, platformDb } from '@/lib/data/scope';
import { resolveDatabaseId } from '@/lib/kernel/system-databases';
import { selectForExport, vatSplit, signedSplit, signed, KIND_LABEL, type ExportDoc, type ExportKind, type ExportSource } from '@/lib/records/accountant-export';
import { storage, resolveDocumentKey } from '@/lib/storage';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';
import JSZip from 'jszip';
import { describeError } from '@/lib/describe-error';

export const runtime = 'nodejs';

/*
 * The accountant export — on the seraph (2026-10-05, Florin: "guards in place, all over — there will be a day
 * when many accountants access many tenant accounts"). Every read and write goes through the session's scoped
 * client: a page outside the session's tenant cannot be read, stamped or audited. The rules (what goes, as
 * what, with which sign) are lib/records/accountant-export.ts. Sources: invoices (incl. credit notes),
 * expenses (incl. credit notes), tickets.
 */

function cleanFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

import { canRunAccountantExport } from '@/lib/roles';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session.user as any).tenantId;
        const role = (session.user as any)?.role;
        const isImpersonating = !!(session.user as any)?.isImpersonating;

        if (!canRunAccountantExport(role, isImpersonating)) {
            return NextResponse.json(
                { error: 'Forbidden: only accountants and workspace administrators can perform accountant export' },
                { status: 403 }
            );
        }

        const url = new URL(req.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const isPreview = url.searchParams.get('preview') === 'true';
        const includeAlreadyExported = url.searchParams.get('includeAlreadyExported') === 'true';

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
        }

        const db = await scopeFromSession();
        // Tenant is a platform model (D4); only its binding is read, for the session's own tenant.
        const tenant = await platformDb().tenant.findUnique({ where: { id: tenantId }, select: { lockedDbIds: true } });
        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }
        const lockedDbIds = (tenant.lockedDbIds as Record<string, string>) || {};
        const sourceDb: Record<ExportSource, string> = {
            invoices: resolveDatabaseId('db-invoices', lockedDbIds),
            expenses: resolveDatabaseId('db-expenses', lockedDbIds),
            tickets: resolveDatabaseId('db-tickets', lockedDbIds),
        };
        const clientsDbId = resolveDatabaseId('db-clients', lockedDbIds);
        const suppliersDbId = resolveDatabaseId('db-suppliers', lockedDbIds);

        const pageSelect = { id: true, properties: true, blocks: true } as const;
        const [invoices, expenses, tickets, clients, suppliers] = await Promise.all([
            db.globalPage.findMany({ where: { databaseId: sourceDb.invoices }, select: pageSelect }),
            db.globalPage.findMany({ where: { databaseId: sourceDb.expenses }, select: pageSelect }),
            db.globalPage.findMany({ where: { databaseId: sourceDb.tickets }, select: pageSelect }),
            db.globalPage.findMany({ where: { databaseId: clientsDbId }, select: { id: true, properties: true } }),
            db.globalPage.findMany({ where: { databaseId: suppliersDbId }, select: { id: true, properties: true } }),
        ]);

        const clientMap = new Map(clients.map(c => [c.id, c]));
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));

        type Doc = ExportDoc & { blocks: unknown };
        const asDocs = (pages: typeof invoices, source: ExportSource): Doc[] =>
            pages.map(p => ({ id: p.id, source, properties: (p.properties as Record<string, unknown>) || {}, blocks: p.blocks }));
        const opts = { startDate, endDate, includeAlreadyExported };
        const sales = selectForExport(asDocs(invoices, 'invoices'), opts);
        const purchases = selectForExport([...asDocs(expenses, 'expenses'), ...asDocs(tickets, 'tickets')], opts);

        const filteredInvoices = sales.toExport;
        const filteredExpenses = purchases.toExport;
        const undatedDocs = [...sales.undated, ...purchases.undated];
        const totalExcludedDrafts = sales.drafts.length + purchases.drafts.length;
        const unvalidatedCount = sales.unvalidated.length + purchases.unvalidated.length;
        const alreadyExportedCount = sales.alreadyExported.length + purchases.alreadyExported.length;
        const toExportCount = filteredInvoices.length + filteredExpenses.length;

        // EXPDLG-1 & SP-3: Server-side preview of counts prior to running the export
        if (isPreview) {
            const kindOf = (d: Doc): ExportKind => d.source === 'tickets' ? 'ticket' : (d.properties?.docType === 'opt-credit-note' ? 'credit-note' : 'invoice');
            const undatedSamples = undatedDocs.map(d => ({
                id: d.id,
                title: String(d.properties?.title || 'Zonder nummer / titel'),
                type: KIND_LABEL[kindOf(d)],
            }));
            return NextResponse.json({
                success: true,
                period: { startDate, endDate },
                includeAlreadyExported,
                toExportCount,
                alreadyExportedCount,
                draftCount: totalExcludedDrafts,
                unvalidatedCount,
                undatedCount: undatedDocs.length,
                undatedDocuments: undatedSamples,
            });
        }

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
            "Documenttype",
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
            const split = signedSplit(inv.kind, vatSplit(inv as any));
            const row = [
                KIND_LABEL[inv.kind],
                props.title || '',
                props.invoiceDate || '',
                `"${getClientName(inv).replace(/"/g, '""')}"`,
                getClientVat(inv),
                `"${(props.betreft || '').replace(/"/g, '""')}"`,
                signed(inv.kind, Number(props.totalExVat) || 0),
                signed(inv.kind, Number(props.totalVat) || 0),
                signed(inv.kind, Number(props.totalIncVat) || 0),
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
            "Documenttype",
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
            let row: Array<string | number>;
            if (exp.kind === 'ticket') {
                // A ticket carries one total (incl. VAT) and no VAT split: the accountant books it from the receipt.
                row = [
                    KIND_LABEL.ticket,
                    '',
                    String(props.date || '').split('T')[0],
                    `"${String(props.title || '').replace(/"/g, '""')}"`,
                    '',
                    `"${String(props.notes || '').replace(/"/g, '""')}"`,
                    props.currency === 'cur-usd' ? 'USD' : props.currency === 'cur-gbp' ? 'GBP' : 'EUR',
                    '',
                    props.category || '',
                    '',
                    props.paymentMethod || '',
                    '',
                    '', '', Number(props.amount) || 0,
                    '', '', '', '', '', '', '', '',
                ];
                purchasesRows.push(row.join(';'));
                continue;
            }
            const split = signedSplit(exp.kind, vatSplit(exp as any));
            row = [
                KIND_LABEL[exp.kind],
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
                signed(exp.kind, Number(props.totalExVat) || 0),
                signed(exp.kind, Number(props.totalVat) || 0),
                signed(exp.kind, Number(props.totalIncVat) || 0),
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

        interface FailedExportDoc {
            id: string;
            title: string;
            type: 'verkoop' | 'aankoop';
            key?: string;
            error: string;
        }

        const failedDocuments: FailedExportDoc[] = [];

        // Fetch & add sales PDFs (if any receiptUrl is provided)
        for (const inv of filteredInvoices) {
            const receiptUrl = (inv.properties as any)?.receiptUrl;
            if (receiptUrl && typeof receiptUrl === 'string' && receiptUrl.trim() !== '') {
                const invNum = (inv.properties as any)?.title || inv.id;
                const resolvedKey = resolveDocumentKey(receiptUrl, tenantId);
                if (!resolvedKey) {
                    failedDocuments.push({
                        id: inv.id,
                        title: invNum,
                        type: 'verkoop',
                        error: `Document key kon niet worden herleid: ${receiptUrl}`
                    });
                    continue;
                }

                try {
                    const fileData = await storage.read(resolvedKey);
                    if (!fileData || fileData.length === 0) {
                        throw new Error('Bestand is leeg');
                    }
                    const clientName = getClientName(inv);
                    const fileName = cleanFileName(`verkoop_${invNum}_${clientName}.pdf`);
                    pdfFolder?.file(fileName, fileData);
                } catch (err: any) {
                    console.error('[financials/export] Failed to read sales PDF:', err);
                    failedDocuments.push({
                        id: inv.id,
                        title: invNum,
                        type: 'verkoop',
                        key: resolvedKey,
                        error: `Bestand kon niet worden gelezen — ${describeError(err)}`
                    });
                }
            }
        }

        // Fetch & add purchases PDFs (if any receiptUrl is provided)
        for (const exp of filteredExpenses) {
            const receiptUrl = (exp.properties as any)?.receiptUrl;
            if (receiptUrl && typeof receiptUrl === 'string' && receiptUrl.trim() !== '') {
                const expNum = (exp.properties as any)?.title || exp.id;
                const resolvedKey = resolveDocumentKey(receiptUrl, tenantId);
                if (!resolvedKey) {
                    failedDocuments.push({
                        id: exp.id,
                        title: expNum,
                        type: 'aankoop',
                        error: `Document key kon niet worden herleid: ${receiptUrl}`
                    });
                    continue;
                }

                try {
                    const fileData = await storage.read(resolvedKey);
                    if (!fileData || fileData.length === 0) {
                        throw new Error('Bestand is leeg');
                    }
                    const supplierName = exp.kind === 'ticket' ? String((exp.properties as any)?.title || 'ticket') : getSupplierName(exp);
                    const fileName = cleanFileName(`${exp.kind === 'ticket' ? 'ticket' : 'aankoop'}_${expNum}_${supplierName}.pdf`);
                    pdfFolder?.file(fileName, fileData);
                } catch (err: any) {
                    console.error('[financials/export] Failed to read purchase PDF:', err);
                    failedDocuments.push({
                        id: exp.id,
                        title: expNum,
                        type: 'aankoop',
                        key: resolvedKey,
                        error: `Bestand kon niet worden gelezen — ${describeError(err)}`
                    });
                }
            }
        }

        // STRICT / ALL-OR-NOTHING (BLOB-4): Abort if ANY document read or resolution failed
        if (failedDocuments.length > 0) {
            return NextResponse.json({
                error: 'Boekhouder export mislukt: een of meer gekoppelde documenten konden niet worden gelezen.',
                failedDocuments
            }, { status: 422 });
        }

        // 4. Generate the ZIP buffer first (ensures ZIP generation succeeds before any DB write)
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // 5. Stamp accountantExportedAt = true and record actor details only after ZIP successfully exists (atomic transaction)
        const actorUserId = (session.user as any)?.id || (session.user as any)?.email || 'system';
        const actorEmail = (session.user as any)?.email || '';
        const actorName = (session.user as any)?.name || '';
        const actorRole = (session.user as any)?.role || 'ACCOUNTANT';
        const actorIdentifier = actorName ? `${actorName} (${actorEmail || actorRole})` : (actorEmail || actorUserId);
        const exportTimestamp = new Date().toISOString();

        const auditScope = {
            tenantId,
            userId: actorUserId,
            userName: actorName,
            userEmail: actorEmail,
            user: { id: actorUserId, name: actorName, email: actorEmail, role: actorRole },
        };

        // Stamp + audit every newly exported document (invoices, credit notes, expenses, tickets) — on the
        // session's scoped client, in ONE transaction: all stamped, or none.
        const toStamp = [...filteredInvoices, ...filteredExpenses].filter(d => d.properties?.accountantExportedAt !== true);
        const auditData = await Promise.all(toStamp.map(d => buildAuditLogData(auditScope, {
            entityType: 'globalPage',
            entityId: d.id,
            action: 'accountant-export',
            field: 'accountantExportedAt',
            before: { accountantExportedAt: false },
            after: {
                accountantExportedAt: true,
                accountantExportedBy: actorIdentifier,
                accountantExportedTimestamp: exportTimestamp,
                role: actorRole,
            },
            reason: `Accountant export for period ${periodStr}`,
        })));
        if (toStamp.length > 0) {
            await db.$transaction(async tx => {
                for (const d of toStamp) {
                    await tx.globalPage.update({
                        where: { id: d.id },
                        data: {
                            properties: {
                                ...d.properties,
                                accountantExportedAt: true,
                                accountantExportedBy: actorIdentifier,
                                accountantExportedById: actorUserId,
                                accountantExportedTimestamp: exportTimestamp,
                            } as object,
                            lastEditedBy: actorEmail || actorUserId || 'system:accountant-export',
                        },
                    });
                }
                for (const data of auditData) await buildAuditLogOperation(tx, data);
            }, { timeout: 60_000 });
        }

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="boekhouding_export_${periodStr}.zip"`,
                'X-Excluded-Drafts-Count': String(totalExcludedDrafts),
            }
        });

    } catch (e: any) {
        console.error('Accountant export failed:', e);
        return NextResponse.json({ error: `Export failed — ${describeError(e)}` }, { status: 500 });
    }
}
