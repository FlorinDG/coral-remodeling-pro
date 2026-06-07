/**
 * Generates a document number client-side as a fallback when the server-side
 * getNextDocumentNumber Server Action is blocked or returns an error (e.g., in Safari PWA standalone mode).
 * Respects the tenant's prefix, connector, date format, and number width settings.
 */
export function generateClientSideDocNumber(
    tenant: Record<string, string | number | boolean | null | undefined> | null | undefined,
    docType: 'invoice' | 'quotation' | 'creditnote'
): string {
    const prefix = (tenant?.[`${docType}Prefix`] as string | undefined) || (docType === 'creditnote' ? 'CN' : docType === 'invoice' ? 'INV' : 'OFF');
    const connector = (tenant?.[`${docType}Connector`] as string | undefined) ?? '-';
    const dateFormat = (tenant?.[`${docType}DateFormat`] as string | undefined) || 'YYYY';
    const numberWidth = (tenant?.[`${docType}NumberWidth`] as number | undefined) ?? 3;
    const nextNumber = (tenant?.[`${docType}NextNumber`] as number | undefined) || 1;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');

    let datePart = '';
    switch (dateFormat) {
        case 'YYYY':     datePart = String(y); break;
        case 'YY':       datePart = String(y).slice(-2); break;
        case 'YYMM':     datePart = `${String(y).slice(-2)}${m}`; break;
        case 'YYYYMM':   datePart = `${y}${m}`; break;
        case 'YYYYMMDD': datePart = `${y}${m}${d}`; break;
        case 'DDMMYYYY': datePart = `${d}${m}${y}`; break;
        case 'MMYYYY':   datePart = `${m}${y}`; break;
        case 'none':
        default:         datePart = ''; break;
    }

    const joiner = connector === 'none' ? '' : connector;
    const parts: string[] = [];
    if (prefix) parts.push(prefix);
    if (datePart) parts.push(datePart);

    // To prevent database unique constraint violation (invoiceNumber + tenantId unique index),
    // we append a 4-digit unique timestamp slice to the next sequence number.
    const uniqueSuffix = String(Date.now()).slice(-4);
    const seqBase = String(nextNumber);
    const seqStr = numberWidth === 0 ? `${seqBase}-${uniqueSuffix}` : `${seqBase.padStart(numberWidth, '0')}-${uniqueSuffix}`;
    parts.push(seqStr);

    return parts.join(joiner);
}
