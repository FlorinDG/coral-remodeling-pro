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

        // ── DOC-ARCH-1: Persist BEFORE transmitting ─────────────────────────
        const { archiveDocument } = await import('@/lib/records/document-archive');
        const { updatePageServerFirst } = await import('@/app/actions/pages');
        const prisma = (await import('@/lib/prisma')).default;

        const page = await prisma.globalPage.findUnique({
            where: { id: quoteId },
            include: { database: { select: { tenantId: true } } }
        });
        if (!page) {
            throw new Error(`[sendQuotationToClient] Offerte record niet gevonden: ${quoteId}`);
        }

        const documentNumber = String((page.properties as any)?.title || projectName || 'Offerte');
        const archiveResult = await archiveDocument({
            tenantId: page.database.tenantId,
            databaseId: page.databaseId,
            pageId: quoteId,
            documentNumber,
            pdf: pdfBuffer,
        });

        // Write receiptUrl to record through server door (DOC-ARCH-1c)
        const currentProps = (page.properties ?? {}) as Record<string, any>;
        const updateRes = await updatePageServerFirst(quoteId, {
            ...currentProps,
            receiptUrl: archiveResult.key,
        });
        if (!updateRes.success) {
            throw new Error(`[sendQuotationToClient] Opslaan van receiptUrl mislukt: ${updateRes.error}`);
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coral-group.be';
        const magicLinkUrl = `${appUrl}/${lang}/quote/${quoteId}`;
        const finalSubject = subjectOverride || `${t('subject_quote', lang)}: ${projectName} — ${company}`;

        const emailAttachments: any[] = [
            {
                filename: archiveResult.filename,
                content: pdfBuffer,
            }
        ];

        // Fetch extra attachments from Blob storage
        if (attachmentKeys && attachmentKeys.length > 0) {
            const { auth } = await import('@/auth');
            const session = await auth();
            const tenantId = session?.user?.tenantId;
            if (!tenantId) throw new Error('Unauthorized for attachments');

            const { storage } = await import('@/lib/storage');

            for (const key of attachmentKeys) {
                if (!key.startsWith(`t_${tenantId}/`)) {
                    throw new Error(`Unauthorized attachment key: ${key}`);
                }
                try {
                    const buffer = await storage.read(key);
                    emailAttachments.push({
                        filename: key.split('/').pop() || key,
                        content: buffer
                    });
                } catch (err) {
                    console.error("Failed to fetch extra attachment:", key, err);
                    throw new Error(`Failed to attach file ${key.split('/').pop() || key}. Email not sent.`);
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

        return { 
            success: true, 
            messageId: data?.id,
            attachments: emailAttachments.map(a => a.filename),
            archiveKey: archiveResult.key,
            archiveFilename: archiveResult.filename,
        };

    } catch (err: any) {
        console.error("Failed to execute quotation mail dispatch:", err);
        const detail = err?.message || err?.cause?.message || err?.name || String(err);
        return { success: false, error: `[${err?.name ?? 'Error'}] ${detail}` };
    }
}
