import React from 'react';
import { platformDb } from '@/lib/data/scope';
import { publicViewRefusal } from '@/lib/records/client-accept';
import { notFound } from 'next/navigation';
import InvoiceViewer from './InvoiceViewer';
import { Block } from '@/components/admin/database/types';

export default async function PublicInvoicePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: invoiceId } = await params;

    // The public link is the key (by design): read by id through the named cross-tenant door (D4), then
    // refused unless it is a invoice of the right KIND that has left draft (lib/records/client-accept).
    const invoice = await platformDb().globalPage.findUnique({
        where: { id: invoiceId },
        include: {
            database: {
                include: {
                    tenant: {
                        select: {
                            companyName: true,
                            commercialName: true,
                            logoUrl: true,
                            brandColor: true,
                            email: true,
                            street: true,
                            city: true,
                            postalCode: true,
                            vatNumber: true,
                            iban: true,
                            bic: true,
                            documentLanguage: true,
                            planType: true,
                            documentMode: true,
                            stationeryUrl: true,
                            documentFont: true,
                            documentFontSize: true,
                            documentTemplate: true,
                        }
                    }
                }
            }
        }
    });

    if (!invoice || publicViewRefusal('invoices', invoice.database.logicalKey, (invoice.properties as Record<string, unknown> | null)?.status)) {
        return notFound();
    }

    const tenant = invoice.database.tenant;
    const lang = locale || tenant.documentLanguage || 'nl';

    // VARIANT-1: each line carries its frozen surcharge — nothing is looked up from a library at view time.
    const enrichedBlocks = ((invoice.blocks as unknown) as Block[]) || [];

    return (
        <InvoiceViewer
            invoiceId={invoice.id}
            properties={invoice.properties}
            blocks={enrichedBlocks}
            tenant={tenant}
            lang={lang}
        />
    );
}
