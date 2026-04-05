"use server";

import prisma from '@/lib/prisma';

export async function acceptQuotation(quoteId: string, signatureBase64: string) {
    try {
        const quote = await prisma.globalPage.findUnique({
            where: { id: quoteId }
        });

        if (!quote) throw new Error("Offerte niet gevonden.");

        const currentProps = typeof quote.properties === 'object' && quote.properties !== null
            ? (quote.properties as Record<string, any>)
            : {};

        // We inject the timestamp, status, and the base64 signature string directly into the JSON properties
        await prisma.globalPage.update({
            where: { id: quoteId },
            data: {
                properties: {
                    ...currentProps,
                    status: "ACCEPTED",
                    clientSignature: signatureBase64,
                    signedAt: new Date().toISOString()
                }
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Signature acceptance failed:", error);
        return { success: false, error: error.message || "Er is een fout opgetreden bij het opslaan." };
    }
}
