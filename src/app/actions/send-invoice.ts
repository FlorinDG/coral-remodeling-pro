"use server";

import { Resend } from 'resend';
import InvoiceEmail from '@/emails/InvoiceEmail';
import React from 'react';

// Require a valid environment variable key or fallback for local development testing
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

export async function sendInvoiceToClient(
    invoiceId: string,
    clientEmail: string,
    clientName: string,
    projectName: string,
    invoiceTotal: string,
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
        const magicLinkUrl = `${appUrl}/nl/invoice/${invoiceId}`;

        // Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'Coral Group <noreply@coral-group.be>',
            to: [clientEmail],
            subject: `Uw Factuur: ${projectName} - Coral Remodeling Pro`,
            react: React.createElement(InvoiceEmail, {
                clientName,
                projectName,
                invoiceTotal,
                magicLinkUrl,
                customMessage: customMessage || 'Hierbij sturen wij u de gevraagde factuur. U kan deze online bekijken, downloaden als PDF, en veilig online ondertekenen voor akkoord.',
            }),
            attachments: [
                {
                    filename: `Factuur_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
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
        console.error("Failed to execute invoice mail dispatch sequence:", err);
        return { success: false, error: err.message || "Failed to send email." };
    }
}

