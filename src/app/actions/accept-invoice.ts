"use server";
import { clientAcceptRefusal } from '@/lib/records/client-accept';
import { platformDb, systemScope } from '@/lib/data/scope';

import { describeError } from '@/lib/describe-error';

interface AcceptInvoicePayload {
    invoiceId: string;
    signatureBase64: string;
    signatureMethod: 'draw' | 'type' | 'upload';
    consentName: string;
}

export async function acceptInvoice({ invoiceId, signatureBase64, signatureMethod, consentName }: AcceptInvoicePayload) {
    try {
        // The link is the key (public by design): the document is read through the platform door — its tenant is
        // not known yet — then the rule decides, then the write goes through THAT tenant's scope (seraph).
        const invoice = await platformDb().globalPage.findUnique({
            where: { id: invoiceId },
            include: { database: { select: { logicalKey: true, tenantId: true } } },
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

        const db = systemScope(invoice.database.tenantId, `client accepted invoice ${invoiceId} via its link`);
        const { saveRecord } = await import('@/lib/data/records');
        const { buildAcceptInvoiceIntent } = await import('@/lib/records/actions-record-intents');
        const { intent, opts } = buildAcceptInvoiceIntent(
            invoiceId,
            { signatureBase64, signatureMethod, consentName },
            invoice.updatedAt.toISOString()
        );
        const saved = await saveRecord(db, intent, opts);

        if (!saved.ok) {
            return { success: false, error: `This invoice cannot be accepted (${saved.refusal.code}).` };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Invoice signature acceptance failed:", error);
        return { success: false, error: `An error occurred while saving. — ${describeError(error)}` };
    }
}
