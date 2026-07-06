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
        const magicLinkUrl = `${appUrl}/${lang}/invoice/${invoiceId}`;
        const finalSubject = subjectOverride || `${t('subject_invoice', lang)}: ${projectName} — ${company}`;

        const emailAttachments = [
            {
                filename: `${t('invoice', lang)}_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
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
            attachments: emailAttachments
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

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { lookupPeppolParticipant } from '@/lib/e-invoice';

export async function checkClientPeppol(vatNumber: string | null | undefined): Promise<{ isRegistered: boolean; message?: string }> {
    if (!vatNumber) return { isRegistered: false, message: 'Geen BTW nummer' };
    
    // basic format cleanup
    const cleanVat = vatNumber.replace(/[^A-Za-z0-9]/g, '');
    let peppolId = cleanVat;
    
    // standard BE format logic (0208 scheme)
    if (cleanVat.startsWith('BE') && cleanVat.length >= 12) {
        peppolId = `0208:${cleanVat.substring(2)}`;
    } else if (/^\d{10}$/.test(cleanVat)) {
        peppolId = `0208:${cleanVat}`;
    } else {
        // We only support BE automatic mapping easily, but could extend. 
        // For now if it's not a clear BE VAT, let's just try 0208:cleanVat anyway
        peppolId = `0208:${cleanVat}`;
    }

    try {
        const session = await auth();
        // @ts-ignore
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return { isRegistered: false, message: 'Niet ingelogd' };

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true }
        });

        if (!tenant?.eInvoiceApiKey) {
            return { isRegistered: false, message: 'Geen Peppol configuratie op dit account' };
        }

        const lookup = await lookupPeppolParticipant(peppolId, tenant.eInvoiceApiKey);
        if (lookup && lookup.participant_id) {
            return { isRegistered: true };
        }
        return { isRegistered: false, message: 'Klant is niet geregistreerd op het Peppol netwerk' };

    } catch (e) {
        return { isRegistered: false, message: 'Fout bij verifiëren van Peppol netwerk status' };
    }
}
