"use server";

import prisma from '@/lib/prisma';

interface AcceptQuotationPayload {
    quoteId: string;
    signatureBase64: string;
    signatureMethod: 'draw' | 'type' | 'upload';
    consentName: string;
}

export async function acceptQuotation({ quoteId, signatureBase64, signatureMethod, consentName }: AcceptQuotationPayload) {
    try {
        const quote = await prisma.globalPage.findUnique({
            where: { id: quoteId }
        });

        if (!quote) throw new Error("Quote not found.");

        const currentProps = typeof quote.properties === 'object' && quote.properties !== null
            ? (quote.properties as Record<string, unknown>)
            : {};

        // Check if already accepted
        if (currentProps.status === 'ACCEPTED' || currentProps.status === 'opt-accepted') {
            return { success: false, error: 'This quotation has already been accepted.' };
        }

        await prisma.globalPage.update({
            where: { id: quoteId },
            data: {
                properties: {
                    ...currentProps,
                    status: "ACCEPTED",
                    clientSignature: signatureBase64,
                    signatureMethod,
                    consentName,
                    signedAt: new Date().toISOString()
                }
            }
        });

        // Auto-create project after successful acceptance
        const quoteWithDb = await prisma.globalPage.findUnique({
            where: { id: quoteId },
            select: { database: { select: { tenantId: true } } }
        });
        
        if (quoteWithDb?.database.tenantId) {
            const { autoCreateProjectFromQuote } = await import('@/lib/services/quote-service');
            await autoCreateProjectFromQuote(quoteId, quoteWithDb.database.tenantId);
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Signature acceptance failed:", error);
        return { success: false, error: error instanceof Error ? error.message : "An error occurred while saving." };
    }
}
