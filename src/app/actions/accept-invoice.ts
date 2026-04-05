"use server";

import prisma from '@/lib/prisma';

export async function acceptInvoice(invoiceId: string, signatureBase64: string) {
    try {
        const invoice = await prisma.globalPage.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) throw new Error("Factuur niet gevonden.");

        const currentProps = typeof invoice.properties === 'object' && invoice.properties !== null
            ? (invoice.properties as Record<string, any>)
            : {};

        // We inject the timestamp, status, and the base64 signature string directly into the JSON properties
        await prisma.globalPage.update({
            where: { id: invoiceId },
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
