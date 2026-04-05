import React from 'react';
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import QuotationViewer from './QuotationViewer';

export default async function PublicQuotePage({ params }: { params: Promise<{ locale: string, id: string }> }) {
    const quoteId = (await params).id;

    const quote = await prisma.globalPage.findUnique({
        where: { id: quoteId },
        include: {
            database: true
        }
    });

    // Ensure it's a valid quote payload
    if (!quote || quote.database.id !== 'db-quotations') {
        return notFound();
    }

    return (
        <div className="min-h-screen bg-neutral-100 flex flex-col items-center py-10 w-full font-sans">
            <div className="w-full max-w-4xl px-4">
                <QuotationViewer
                    quoteId={quote.id}
                    properties={quote.properties}
                    blocks={quote.blocks}
                />
            </div>
        </div>
    );
}
