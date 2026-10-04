"use server";
import { clientAcceptRefusal } from '@/lib/records/client-accept';

import prisma from '@/lib/prisma';
import { describeError } from '@/lib/describe-error';

interface AcceptInvoicePayload {
    invoiceId: string;
    signatureBase64: string;
    signatureMethod: 'draw' | 'type' | 'upload';
    consentName: string;
}

export async function acceptInvoice({ invoiceId, signatureBase64, signatureMethod, consentName }: AcceptInvoicePayload) {
    try {
        const invoice = await prisma.globalPage.findUnique({
            where: { id: invoiceId },
            include: { database: { select: { logicalKey: true } } },
        });

        if (!invoice) throw new Error("Invoice not found.");

        const currentProps = typeof invoice.properties === 'object' && invoice.properties !== null
            ? (invoice.properties as Record<string, any>)
            : {};

        // R2-1-CENSUS #9: only a SENT invoice can be accepted from its link — any other record id
        // (an article, a project, another tenant's anything) used to be overwritten here.
        const refusal = clientAcceptRefusal('invoices', invoice.database?.logicalKey, currentProps.status);
        if (refusal === 'already_accepted') return { success: false, error: 'This invoice has already been accepted.' };
        if (refusal) return { success: false, error: 'This invoice cannot be accepted.' };

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
                },
                lastEditedBy: 'system:accept-invoice'
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Invoice signature acceptance failed:", error);
        return { success: false, error: `An error occurred while saving. — ${describeError(error)}` };
    }
}
