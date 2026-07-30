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

        return { 
            success: true, 
            messageId: data?.id,
            attachments: emailAttachments.map(a => a.filename)
        };

    } catch (err: any) {
        console.error("Failed to execute invoice mail dispatch:", err);
        return { success: false, error: err.message || "Failed to send email." };
    }
}

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { lookupPeppolParticipant } from '@/lib/e-invoice';

export async function checkClientPeppol(vatNumber: string | null | undefined): Promise<{ status: 'registered' | 'not_registered' | 'unknown'; scheme?: '0208' | '9925'; message?: string }> {
    if (!vatNumber) return { status: 'not_registered', message: 'Geen BTW nummer' };
    
    const cleanVat = vatNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const digits = cleanVat.startsWith('BE') ? cleanVat.slice(2) : cleanVat;
    
    const candidates: Array<{ id: string, scheme: '0208' | '9925' }> = [
        { id: `0208:${digits}`, scheme: '0208' },
        { id: `9925:BE${digits}`, scheme: '9925' }
    ];

    try {
        const session = await auth();
        // @ts-ignore
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return { status: 'unknown', message: 'Niet ingelogd' };

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { eInvoiceApiKey: true }
        });

        if (!tenant?.eInvoiceApiKey) {
            return { status: 'unknown', message: 'Geen Peppol configuratie op dit account' };
        }

        let anyInconclusive = false;
        for (const candidate of candidates) {
            const lookup = await lookupPeppolParticipant(candidate.id, tenant.eInvoiceApiKey);
            if (lookup.classification === 'registered') {
                return { status: 'registered', scheme: candidate.scheme };
            } else if (lookup.classification === 'inconclusive') {
                anyInconclusive = true;
            }
        }

        if (anyInconclusive) {
            return { status: 'unknown', message: 'Peppol-status kon niet worden geverifieerd' };
        }

        return { status: 'not_registered', message: 'Klant is niet geregistreerd op het Peppol netwerk' };

    } catch (e: any) {
        return { status: 'unknown', message: 'Fout bij verifiëren van Peppol netwerk status' };
    }
}
