"use server";
import { clientAcceptRefusal } from '@/lib/records/client-accept';
import { platformDb, systemScope } from '@/lib/data/scope';

interface AcceptQuotationPayload {
    quoteId: string;
    signatureBase64: string;
    signatureMethod: 'draw' | 'type' | 'upload';
    consentName: string;
}

export async function acceptQuotation({ quoteId, signatureBase64, signatureMethod, consentName }: AcceptQuotationPayload) {
    try {
        // The link is the key (public by design): the document is read through the platform door — its tenant is
        // not known yet — then the rule decides, then the write goes through THAT tenant's scope (seraph).
        const quote = await platformDb().globalPage.findUnique({
            where: { id: quoteId },
            include: { database: { select: { logicalKey: true, tenantId: true } } },
        });

        if (!quote) throw new Error("Quote not found.");

        const currentProps = typeof quote.properties === 'object' && quote.properties !== null
            ? (quote.properties as Record<string, unknown>)
            : {};

        // R2-1-CENSUS #10: only a SENT quotation can be accepted from its link — any other record id
        // (an article, a project, another tenant's anything) used to be overwritten here.
        const refusal = clientAcceptRefusal('quotations', quote.database?.logicalKey, currentProps.status);
        if (refusal === 'already_accepted') return { success: false, error: 'This quotation has already been accepted.' };
        if (refusal) return { success: false, error: 'This quotation cannot be accepted.' };

        const db = systemScope(quote.database.tenantId, `client accepted quotation ${quoteId} via its link`);
        const { saveRecord } = await import('@/lib/data/records');
        const { buildAcceptQuoteIntent } = await import('@/lib/records/actions-record-intents');
        const { intent, opts } = buildAcceptQuoteIntent(
            quoteId,
            { signatureBase64, signatureMethod, consentName },
            quote.updatedAt.toISOString()
        );
        const saved = await saveRecord(db, intent, opts);

        if (!saved.ok) {
            return { success: false, error: `This quotation cannot be accepted (${saved.refusal.code}).` };
        }

        // Auto-create project after successful acceptance — in the quote's own tenant (read above)
        const quoteWithDb = quote;
        
        if (quoteWithDb?.database.tenantId) {
            const { autoCreateProjectFromQuote } = await import('@/lib/services/quote-service');
            await autoCreateProjectFromQuote(quoteId, quoteWithDb.database.tenantId);

            // Fetch tenant details for email notification
            try {
                const tenant = await platformDb().tenant.findUnique({   // Tenant: platform model (D4)
                    where: { id: quoteWithDb.database.tenantId }
                });

                const quoteTitle = (currentProps.betreft as string) || (currentProps.title as string) || 'Offerte';

                // Emit in-app notification
                const { notify } = await import('@/lib/notifications');
                const assigneeId = (quote.assignedTo && quote.assignedTo.length > 0) ? quote.assignedTo[0] : (quote.createdBy || null);
                await notify(
                    {
                        userId: assigneeId,
                        topic: 'quotes.accepted',
                        title: 'Quote Accepted',
                        body: `Quote ${quoteTitle} accepted by ${consentName}`,
                        entity: { type: 'quote', id: quoteId },
                        href: `/nl/admin/database/db-quotations/${quoteId}`
                    },
                    { tenantId: quoteWithDb.database.tenantId, db }
                ).catch(e => console.error("Failed to create quotes.accepted notification:", e));

                if (tenant?.email) {
                    const { Resend } = await import('resend');
                    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
                    const quoteLink = `${appUrl}/nl/quote/${quoteId}`;
                    const date = new Date().toLocaleDateString('nl-BE');

                    await resend.emails.send({
                        from: `${tenant.commercialName || tenant.companyName || 'Coral Enterprises'} <noreply@coral-group.be>`,
                        to: [tenant.email],
                        subject: `Offerte geaccepteerd: ${quoteTitle}`,
                        html: `
                            <p>Beste ${tenant.commercialName || tenant.companyName},</p>
                            <p>Uw offerte <strong>${quoteTitle}</strong> is succesvol geaccepteerd en ondertekend door <strong>${consentName}</strong> op ${date}.</p>
                            <p>Er is automatisch een nieuw project voor u aangemaakt.</p>
                            <p>U kunt de getekende offerte hier bekijken: <a href="${quoteLink}">${quoteLink}</a></p>
                        `
                    });
                }
            } catch (emailErr) {
                console.error("Failed to send signature notification email to tenant:", emailErr);
            }
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Signature acceptance failed:", error);
        return { success: false, error: error instanceof Error ? error.message : "An error occurred while saving." };
    }
}
