"use server";

import { Resend } from 'resend';
import QuotationEmail from '@/emails/QuotationEmail';
import { t } from '@/lib/document-i18n';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_fallback');

export async function sendQuotationToClient(
    quoteId: string,
    clientEmail: string,
    clientName: string,
    projectName: string,
    quoteTotal: string,
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const magicLinkUrl = `${appUrl}/nl/quote/${quoteId}`;

        const { data, error } = await resend.emails.send({
            from: `${company} <noreply@coral-group.be>`,
            to: [clientEmail],
            subject: `${t('subject_quote', lang)}: ${projectName} — ${company}`,
            react: React.createElement(QuotationEmail, {
                clientName,
                projectName,
                quoteTotal,
                magicLinkUrl,
                customMessage,
                companyName: company,
                language: lang,
                brandColor: brandColor || '#d35400',
            }),
            attachments: [
                {
                    filename: `${t('quotation', lang)}_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
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
        console.error("Failed to execute quotation mail dispatch:", err);
        return { success: false, error: err.message || "Failed to send email." };
    }
}
