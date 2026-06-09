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
                    status: "opt-accepted",
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

            // Fetch tenant details for email notification
            try {
                const tenant = await prisma.tenant.findUnique({
                    where: { id: quoteWithDb.database.tenantId }
                });

                if (tenant?.email) {
                    const { Resend } = await import('resend');
                    const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');
                    const quoteTitle = (currentProps.betreft as string) || (currentProps.title as string) || 'Offerte';
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
