"use server";

import prisma from '@/lib/prisma';

interface AcceptInvoicePayload {
    invoiceId: string;
    signatureBase64: string;
    signatureMethod: 'draw' | 'type' | 'upload';
    consentName: string;
}

export async function acceptInvoice({ invoiceId, signatureBase64, signatureMethod, consentName }: AcceptInvoicePayload) {
    try {
        const invoice = await prisma.globalPage.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) throw new Error("Invoice not found.");

        const currentProps = typeof invoice.properties === 'object' && invoice.properties !== null
            ? (invoice.properties as Record<string, any>)
            : {};

        // Check if already accepted
        if (currentProps.status === 'ACCEPTED') {
            return { success: false, error: 'This invoice has already been accepted.' };
        }

        await prisma.globalPage.update({
            where: { id: invoiceId },
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

        return { success: true };
    } catch (error: any) {
        console.error("Invoice signature acceptance failed:", error);
        return { success: false, error: error.message || "An error occurred while saving." };
    }
}
