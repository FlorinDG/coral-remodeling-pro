"use server";

import { Resend } from 'resend';
import InvoiceEmail from '@/emails/InvoiceEmail';
import { t } from '@/lib/document-i18n';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

export async function sendInvoiceToClient(
    invoiceId: string,
    clientEmail: string,
    clientName: string,
    projectName: string,
    invoiceTotal: string,
    pdfBufferBase64: string,
    customMessage?: string,
    companyName?: string,
    language?: string,
    brandColor?: string
) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is missing. Email will be simulated.');
    }

    const lang = language || 'nl';
    const company = companyName || 'Coral Enterprises';

    try {
        const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        const magicLinkUrl = `${appUrl}/nl/invoice/${invoiceId}`;

        const { data, error } = await resend.emails.send({
            from: `${company} <noreply@coral-group.be>`,
            to: [clientEmail],
            subject: `${t('subject_invoice', lang)}: ${projectName} — ${company}`,
            react: React.createElement(InvoiceEmail, {
                clientName,
                projectName,
                invoiceTotal,
                magicLinkUrl,
                customMessage,
                companyName: company,
                language: lang,
                brandColor: brandColor || '#d35400',
            }),
            attachments: [
                {
                    filename: `${t('invoice', lang)}_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
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
        console.error("Failed to execute invoice mail dispatch:", err);
        return { success: false, error: err.message || "Failed to send email." };
    }
}
