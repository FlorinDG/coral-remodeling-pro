import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import QuotationViewer from './QuotationViewer';

export default async function PublicQuotePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: quoteId } = await params;

    const quote = await prisma.globalPage.findUnique({
        where: { id: quoteId },
        include: {
            database: {
                include: {
                    tenant: {
                        select: {
                            companyName: true,
                            logoUrl: true,
                            brandColor: true,
                            email: true,
                            street: true,
                            city: true,
                            postalCode: true,
                            vatNumber: true,
                            documentLanguage: true,
                            planType: true,
                        }
                    }
                }
            }
        }
    });

    // Ensure it's a valid quote payload
    if (!quote || quote.database.id !== 'db-quotations') {
        return notFound();
    }

    const tenant = quote.database.tenant;
    // Language priority: URL locale > tenant document language > 'nl'
    const lang = locale || tenant.documentLanguage || 'nl';

    return (
        <QuotationViewer
            quoteId={quote.id}
            properties={quote.properties}
            blocks={quote.blocks}
            tenant={{
                companyName: tenant.companyName,
                logoUrl: tenant.logoUrl,
                brandColor: tenant.brandColor,
                email: tenant.email,
                vatNumber: tenant.vatNumber,
                planType: tenant.planType,
            }}
            lang={lang}
        />
    );
}
