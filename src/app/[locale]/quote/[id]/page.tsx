import React from 'react';
import { platformDb } from '@/lib/data/scope';
import { publicViewRefusal } from '@/lib/records/client-accept';
import { notFound } from 'next/navigation';
import QuotationViewer from './QuotationViewer';
import { Block } from '@/components/admin/database/types';

export default async function PublicQuotePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: quoteId } = await params;

    // The public link is the key (by design): read by id through the named cross-tenant door (D4), then
    // refused unless it is a quote of the right KIND that has left draft (lib/records/client-accept).
    const quote = await platformDb().globalPage.findUnique({
        where: { id: quoteId },
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

    if (!quote || publicViewRefusal('quotations', quote.database.logicalKey, (quote.properties as Record<string, unknown> | null)?.status)) {
        return notFound();
    }

    const tenant = quote.database.tenant;
    // Language priority: URL locale > tenant document language > 'nl'
    const lang = locale || tenant.documentLanguage || 'nl';

    // VARIANT-1: each line carries its frozen surcharge — nothing is looked up from a library at view time.
    const enrichedBlocks = ((quote.blocks as unknown) as Block[]) || [];

    return (
        <QuotationViewer
            quoteId={quote.id}
            properties={quote.properties}
            blocks={enrichedBlocks}
            tenant={tenant}
            lang={lang}
        />
    );
}
