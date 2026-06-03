/**
 * e-invoice.be Inbox API Client
 * Handles receiving and managing incoming Peppol invoices/credit notes.
 * 
 * Uses per-tenant API keys (same as sending).
 * Endpoints: /api/inbox/, /api/inbox/invoices, /api/inbox/credit-notes
 */

import { XMLParser } from 'fast-xml-parser';

const BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';

function tenantHeaders(apiKey: string) {
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
}

// ── Types (aligned with e-invoice-api SDK DocumentResponse) ──

export interface InboxDocument {
    id: string;
    document_type?: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
    direction?: 'INBOUND' | 'OUTBOUND';
    state?: 'DRAFT' | 'TRANSIT' | 'FAILED' | 'SENT' | 'RECEIVED';
    vendor_name?: string | null;
    vendor_tax_id?: string | null;
    vendor_address?: string | null;
    customer_name?: string | null;
    customer_tax_id?: string | null;
    invoice_id?: string | null;
    invoice_date?: string | null;
    due_date?: string | null;
    invoice_total?: string | null;
    subtotal?: string | null;
    total_tax?: string | null;
    currency?: string;
    items?: Array<{
        description?: string | null;
        quantity?: number | string | null;
        unit_price?: number | string | null;
        amount?: number | string | null;
        tax_rate?: string | null;
        unit_code?: string | null;
    }> | null;
    note?: string | null;
    // UBL XML is accessed via separate /api/documents/{id}/ubl endpoint — NOT inline
}

export interface InboxListResponse {
    items: InboxDocument[];
    total: number;
    page?: number;
    page_size?: number;
    pages?: number;
}

export interface ParsedPurchaseInvoice {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    supplierName: string;
    supplierVat: string;
    supplierAddress: string;
    buyerName: string;
    buyerVat: string;
    currency: string;
    lines: ParsedInvoiceLine[];
    totalExVat: number;
    totalVat: number;
    totalIncVat: number;
    peppolDocId: string;
    rawXml: string;
}

export interface ParsedInvoiceLine {
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    vatRate: number;
    lineTotal: number;
}

// ── Inbox API ──

export async function listInboxDocuments(apiKey: string): Promise<InboxListResponse> {
    const res = await fetch(`${BASE_URL}/api/inbox/?page=1&page_size=100`, {
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox list failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function listInboxInvoices(apiKey: string): Promise<InboxListResponse> {
    const res = await fetch(`${BASE_URL}/api/inbox/invoices?page=1&page_size=100`, {
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox invoices list failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function listInboxCreditNotes(apiKey: string): Promise<InboxListResponse> {
    const res = await fetch(`${BASE_URL}/api/inbox/credit-notes?page=1&page_size=100`, {
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox credit-notes list failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function getInboxDocument(apiKey: string, docId: string): Promise<InboxDocument> {
    const res = await fetch(`${BASE_URL}/api/inbox/${docId}`, {
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox get doc failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function acceptInboxDocument(apiKey: string, docId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/inbox/${docId}/accept`, {
        method: 'POST',
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox accept failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function rejectInboxDocument(apiKey: string, docId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/inbox/${docId}/reject`, {
        method: 'POST',
        headers: tenantHeaders(apiKey),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Inbox reject failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
}

// ── UBL/XML Parser ──

/**
 * Parse a Peppol UBL XML invoice into structured data.
 * Handles both UBL Invoice and CreditNote structures.
 * Uses import-first approach: extracts all available fields,
 * infers what's possible, leaves blank what can't be determined.
 */
export function parseUBLToInvoice(ublXml: string, peppolDocId: string): ParsedPurchaseInvoice {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true, // Strip namespace prefixes for clean access
        isArray: (tagName) => ['InvoiceLine', 'CreditNoteLine', 'TaxSubtotal'].includes(tagName),
    });

    const parsed = parser.parse(ublXml);
    const doc = parsed.Invoice || parsed.CreditNote || {};

    // Extract supplier (AccountingSupplierParty)
    const supplierParty = doc.AccountingSupplierParty?.Party || {};
    const supplierName = supplierParty.PartyName?.Name
        || supplierParty.PartyLegalEntity?.RegistrationName
        || '';
    const supplierVat = supplierParty.PartyTaxScheme?.CompanyID || '';
    const supplierAddr = supplierParty.PostalAddress || {};
    const supplierAddress = [
        supplierAddr.StreetName,
        supplierAddr.CityName,
        supplierAddr.PostalZone,
        supplierAddr.Country?.IdentificationCode,
    ].filter(Boolean).join(', ');

    // Extract buyer (AccountingCustomerParty)
    const buyerParty = doc.AccountingCustomerParty?.Party || {};
    const buyerName = buyerParty.PartyName?.Name
        || buyerParty.PartyLegalEntity?.RegistrationName
        || '';
    const buyerVat = buyerParty.PartyTaxScheme?.CompanyID || '';

    // Extract line items
    const rawLines = doc.InvoiceLine || doc.CreditNoteLine || [];
    const lines: ParsedInvoiceLine[] = (Array.isArray(rawLines) ? rawLines : [rawLines]).map((item: unknown) => {
        const line = item as Record<string, any>;
        const quantity = parseFloat(line.InvoicedQuantity || line.CreditedQuantity || '1');
        const unitCode = line.InvoicedQuantity?.['@_unitCode'] || line.CreditedQuantity?.['@_unitCode'] || 'C62';
        const unitPrice = parseFloat(line.Price?.PriceAmount || '0');
        const lineTotal = parseFloat(line.LineExtensionAmount || '0');

        // VAT rate from line-level tax
        const taxPercent = line.Item?.ClassifiedTaxCategory?.Percent
            || line.TaxTotal?.TaxSubtotal?.[0]?.TaxCategory?.Percent
            || 0;

        return {
            description: line.Item?.Name || line.Item?.Description || '',
            quantity,
            unitCode,
            unitPrice,
            vatRate: parseFloat(String(taxPercent)),
            lineTotal,
        };
    });

    // Extract totals
    const legalTotal = doc.LegalMonetaryTotal || {};
    const totalExVat = parseFloat(legalTotal.TaxExclusiveAmount || '0');
    const totalIncVat = parseFloat(legalTotal.PayableAmount || legalTotal.TaxInclusiveAmount || '0');

    // VAT total from TaxTotal
    const taxTotal = doc.TaxTotal;
    const totalVat = parseFloat(
        (Array.isArray(taxTotal) ? taxTotal[0] : taxTotal)?.TaxAmount || '0'
    );

    return {
        invoiceNumber: doc.ID || '',
        issueDate: doc.IssueDate || '',
        dueDate: doc.DueDate || doc.PaymentMeans?.PaymentDueDate || '',
        supplierName,
        supplierVat,
        supplierAddress,
        buyerName,
        buyerVat,
        currency: doc.DocumentCurrencyCode || 'EUR',
        lines,
        totalExVat,
        totalVat,
        totalIncVat,
        peppolDocId,
        rawXml: ublXml,
    };
}
