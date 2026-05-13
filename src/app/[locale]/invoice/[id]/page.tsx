import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoiceViewer from './InvoiceViewer';

export default async function PublicInvoicePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const { locale, id: invoiceId } = await params;

    const invoice = await prisma.globalPage.findUnique({
        where: { id: invoiceId },
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

    // Ensure it's a valid invoice payload
    if (!invoice || !invoice.database.id.includes('db-invoices')) {
        return notFound();
    }

    const tenant = invoice.database.tenant;
    const lang = locale || tenant.documentLanguage || 'nl';

    return (
        <InvoiceViewer
            invoiceId={invoice.id}
            properties={invoice.properties}
            blocks={invoice.blocks}
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
