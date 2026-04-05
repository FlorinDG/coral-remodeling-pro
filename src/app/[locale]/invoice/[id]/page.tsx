import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoiceViewer from './InvoiceViewer';

export default async function PublicQuotePage({ params }: { params: { locale: string, id: string } }) {
    const invoiceId = params.id;

    const invoice = await prisma.globalPage.findUnique({
        where: { id: invoiceId },
        include: {
            database: true
        }
    });

    // Ensure it's a valid invoice payload
    if (!invoice || invoice.database.id !== 'db-invoices') {
        return notFound();
    }

    return (
        <div className="min-h-screen bg-neutral-100 flex flex-col items-center py-10 w-full font-sans">
            <div className="w-full max-w-4xl px-4">
                <InvoiceViewer
                    invoiceId={invoice.id}
                    properties={invoice.properties}
                    blocks={invoice.blocks}
                />
            </div>
        </div>
    );
}
