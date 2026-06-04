"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

type DocType = 'invoice' | 'quotation';

/**
 * Formats a date string based on the chosen date format.
 */
function formatDate(format: string): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    switch (format) {
        case 'YYYY':     return String(y);
        case 'YY':       return String(y).slice(-2);
        case 'YYMM':     return `${String(y).slice(-2)}${m}`;
        case 'YYYYMM':   return `${y}${m}`;
        case 'YYYYMMDD': return `${y}${m}${d}`;
        case 'DDMMYYYY': return `${d}${m}${y}`;
        case 'MMYYYY':   return `${m}${y}`;
        case 'none':
        default:         return '';
    }
}

/**
 * Assembles a document number from its components.
 * Example: INV-2026-001
 */
function assembleNumber(
    prefix: string,
    connector: string,
    dateFormat: string,
    numberWidth: number,
    sequenceNumber: number
): string {
    const joiner = connector === 'none' ? '' : connector;
    const parts: string[] = [];
    
    if (prefix) parts.push(prefix);
    
    const datePart = formatDate(dateFormat);
    if (datePart) parts.push(datePart);
    
    parts.push(numberWidth === 0 ? String(sequenceNumber) : String(sequenceNumber).padStart(numberWidth, '0'));
    
    return parts.join(joiner);
}

/**
 * Atomically fetches the next document number for a given type,
 * increments the counter in the database, and returns the formatted string.
 */
export async function getNextDocumentNumber(docType: DocType): Promise<{ success: boolean; number?: string; error?: string }> {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return { success: false, error: 'Unauthorized' };

        const prefixField = `${docType}Prefix`;
        const connectorField = `${docType}Connector`;
        const dateFormatField = `${docType}DateFormat`;
        const numberWidthField = `${docType}NumberWidth`;
        const nextNumberField = `${docType}NextNumber`;

        // Fetch current settings
        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: {
                [prefixField]: true,
                [connectorField]: true,
                [dateFormatField]: true,
                [numberWidthField]: true,
                [nextNumberField]: true,
            }
        });

        if (!tenant) return { success: false, error: 'Tenant not found' };

        const prefix = tenant[prefixField] || '';
        const connector = tenant[connectorField] || '-';
        const dateFormat = tenant[dateFormatField] || 'YYYY';
        const numberWidth = tenant[numberWidthField] ?? 3;
        const storedNextNumber = tenant[nextNumberField] || 1;

        const datePart = formatDate(dateFormat);
        const joiner = connector === 'none' ? '' : connector;
        
        const baseParts: string[] = [];
        if (prefix) baseParts.push(prefix);
        if (datePart) baseParts.push(datePart);
        const basePrefix = baseParts.join(joiner) + (baseParts.length > 0 ? joiner : '');

        let maxSeq = 0;

        if (docType === 'invoice') {
            const invoices = await (prisma.invoice as any).findMany({
                where: { tenantId, invoiceNumber: { startsWith: basePrefix } },
                select: { invoiceNumber: true }
            });
            for (const inv of invoices) {
                if (!inv.invoiceNumber) continue;
                const seqStr = inv.invoiceNumber.substring(basePrefix.length);
                const seqNum = parseInt(seqStr, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) {
                    maxSeq = seqNum;
                }
            }
        } else if (docType === 'quotation') {
            const quotes = await (prisma.quotation as any).findMany({
                where: { tenantId, quoteNumber: { startsWith: basePrefix } },
                select: { quoteNumber: true }
            });
            for (const q of quotes) {
                if (!q.quoteNumber) continue;
                const seqStr = q.quoteNumber.substring(basePrefix.length);
                const seqNum = parseInt(seqStr, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) {
                    maxSeq = seqNum;
                }
            }
        }

        const nextNumberToUse = Math.max(maxSeq + 1, storedNextNumber);
        const formattedNumber = basePrefix + (numberWidth === 0 ? String(nextNumberToUse) : String(nextNumberToUse).padStart(numberWidth, '0'));

        return { success: true, number: formattedNumber };
    } catch (e: any) {
        console.error('Error generating document number:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Preview what the next document number would look like without consuming it.
 */
export async function previewDocumentNumber(docType: DocType): Promise<string> {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) return '---';

        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId },
            select: {
                [`${docType}Prefix`]: true,
                [`${docType}Connector`]: true,
                [`${docType}DateFormat`]: true,
                [`${docType}NumberWidth`]: true,
                [`${docType}NextNumber`]: true,
            }
        });

        if (!tenant) return '---';

        return assembleNumber(
            tenant[`${docType}Prefix`] || '',
            tenant[`${docType}Connector`] || '-',
            tenant[`${docType}DateFormat`] || 'YYYY',
            tenant[`${docType}NumberWidth`] ?? 3,
            tenant[`${docType}NextNumber`] || 1
        );
    } catch {
        return '---';
    }
}
