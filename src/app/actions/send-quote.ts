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
    brandColor?: string,
    tenantEmail?: string,
    subjectOverride?: string,
    attachmentKeys?: string[]
) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is missing. Email will be simulated.');
    }

    const lang = language || 'nl';
    const company = companyName || 'Coral Enterprises';

    try {
        const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        const magicLinkUrl = `${appUrl}/${lang}/quote/${quoteId}`;
        const finalSubject = subjectOverride || `${t('subject_quote', lang)}: ${projectName} — ${company}`;

        const emailAttachments = [
            {
                filename: `${t('quotation', lang)}_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                content: pdfBuffer,
            }
        ];

        // Fetch extra attachments from Blob storage
        if (attachmentKeys && attachmentKeys.length > 0) {
            const { auth } = await import('@/auth');
            const session = await auth();
            const tenantId = session?.user?.tenantId;
            if (!tenantId) throw new Error('Unauthorized for attachments');

            const { head } = await import('@vercel/blob');
            const token = process.env.BLOB_READ_WRITE_TOKEN;

            for (const key of attachmentKeys) {
                if (!key.startsWith(`t_${tenantId}/`)) continue; // Security check
                try {
                    const meta = await head(key, { token });
                    if (meta?.downloadUrl) {
                        const res = await fetch(meta.downloadUrl);
                        if (res.ok) {
                            const buffer = Buffer.from(await res.arrayBuffer());
                            emailAttachments.push({
                                filename: key.split('/').pop() || key,
                                content: buffer
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch extra attachment:", key, err);
                }
            }
        }

        const { data, error } = await resend.emails.send({
            from: `${company} <noreply@coral-group.be>`,
            to: [clientEmail],
            bcc: tenantEmail ? [tenantEmail] : undefined,
            replyTo: tenantEmail || undefined,
            subject: finalSubject,
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
            attachments: emailAttachments
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
