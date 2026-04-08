"use server";

import { Resend } from 'resend';
import QuotationEmail from '@/emails/QuotationEmail';
import React from 'react';

// Require a valid environment variable key or fallback for local development testing
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

export async function sendQuotationToClient(
    quoteId: string,
    clientEmail: string,
    clientName: string,
    projectName: string,
    quoteTotal: string,
    pdfBufferBase64: string,
    customMessage?: string
) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is missing. Email will be simulated.');
    }

    try {
        // Convert base64 string back into a neat binary buffer attachment
        const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');

        // Construct Secure Magic Link pointing back to the application domain
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const magicLinkUrl = `${appUrl}/nl/quote/${quoteId}`;

        // Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'Coral Remodeling <noreply@coralremodeling.be>',
            to: [clientEmail],
            subject: `Uw Offerte: ${projectName} - Coral Remodeling Pro`,
            react: React.createElement(QuotationEmail, {
                clientName,
                projectName,
                quoteTotal,
                magicLinkUrl,
                customMessage: customMessage || 'Hierbij sturen wij u de gevraagde offerte. U kan deze online bekijken, downloaden als PDF, en veilig online ondertekenen voor akkoord.',
            }),
            attachments: [
                {
                    filename: `Offerte_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                    content: pdfBuffer,
                }
            ]
        });

        if (error) {
            console.error("Resend API Delivery Error:", error);
            throw new Error(error.message);
        }

        return { success: true, messageId: data?.id };

    } catch (err: any) {
        console.error("Failed to execute quotation mail dispatch sequence:", err);
        return { success: false, error: err.message || "Failed to send email." };
    }
}

