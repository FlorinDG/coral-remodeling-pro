/* eslint-disable @typescript-eslint/no-explicit-any */

export interface InvoiceLinePayload {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    amount: number;
    tax_rate: string;
}

export interface InvoiceBlock {
    id: string;
    type: string;
    content: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    verkoopPrice?: number;
    vatRate?: number;
    vatMedecontractant?: boolean;
    isOptional?: boolean;
    children?: InvoiceBlock[];
}

export interface BuildPayloadParams {
    invoiceId: string;
    blocks: InvoiceBlock[];
    client: any;
    invoiceTitle: string;
    betreft?: string;
    invoiceDate?: string;
    dueDate?: string;
    isCreditNote?: boolean;
    parentInvoiceNumber?: string;
    structuredComm?: string;
    tenant: {
        companyName: string | null;
        vatNumber: string | null;
        street: string | null;
        postalCode: string | null;
        city: string | null;
        email: string | null;
        iban: string | null;
        bic: string | null;
    };
    userEmail?: string;
}

/** Maps internal unit strings to UN/CEFACT codes required by e-invoice.be */
export function mapUnitToCode(unit?: string): string {
    if (!unit) return 'C62'; // Default: pieces/units
    const lower = unit.toLowerCase().trim();
    const map: Record<string, string> = {
        'stuks': 'C62', 'stuk': 'C62', 'pcs': 'C62', 'st': 'C62', 'pc': 'C62',
        'uur': 'HUR', 'uren': 'HUR', 'u': 'HUR', 'h': 'HUR', 'hour': 'HUR', 'hours': 'HUR',
        'dag': 'DAY', 'dagen': 'DAY', 'day': 'DAY', 'days': 'DAY',
        'm': 'MTR', 'meter': 'MTR', 'meters': 'MTR', 'lm': 'MTR', 'ml': 'MTR',
        'm2': 'MTK', 'm²': 'MTK',
        'm3': 'MTQ', 'm³': 'MTQ',
        'kg': 'KGM', 'kilo': 'KGM',
        'l': 'LTR', 'liter': 'LTR',
        'forfait': 'C62', 'forf.': 'C62', 'forf': 'C62', 'vp': 'C62', 'lot': 'C62', 'set': 'C62',
        'stk': 'C62',
    };
    return map[lower] || 'C62';
}

/**
 * Recursively flattens the block tree into e-invoice.be line items.
 * Only includes priced lines (type: line, article, bestek) that are NOT optional.
 */
export function flattenBlocksToLineItems(blocks: InvoiceBlock[]): InvoiceLinePayload[] {
    const items: InvoiceLinePayload[] = [];

    const walk = (nodes: InvoiceBlock[]) => {
        for (const block of nodes) {
            if (block.isOptional) continue;

            if (block.type === 'section' || block.type === 'subsection' || block.type === 'post') {
                walk(block.children || []);
            } else if (block.type === 'line' || block.type === 'article' || block.type === 'bestek') {
                const qty = block.quantity || 1;
                const price = block.unitPrice || block.verkoopPrice || 0;
                if (price === 0 && !block.content) continue; // skip empty lines

                const lineTotal = price * qty;
                const vatRate = block.vatMedecontractant ? 0 : (block.vatRate ?? 21);
                const unitCode = mapUnitToCode(block.unit);

                items.push({
                    description: block.content || 'Dienstverlening',
                    quantity: qty,
                    unit: unitCode,
                    unit_price: Math.round(price * 100) / 100,
                    amount: Math.round(lineTotal * 100) / 100,
                    tax_rate: vatRate.toFixed(2),
                });
            }
        }
    };

    walk(blocks);
    return items;
}

export function buildPeppolPayload(params: BuildPayloadParams) {
    const {
        invoiceId,
        blocks,
        client,
        invoiceTitle,
        betreft,
        invoiceDate,
        dueDate,
        isCreditNote,
        parentInvoiceNumber,
        structuredComm,
        tenant,
        userEmail
    } = params;

    const today = new Date().toISOString().split('T')[0];
    const due = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const cleanVat = (vat: string) => vat.replace(/[\s.]/g, '').toUpperCase();
    let vendorVat = tenant.vatNumber ? cleanVat(tenant.vatNumber) : '';
    if (vendorVat && /^\d+$/.test(vendorVat)) {
        vendorVat = 'BE' + vendorVat;
    }

    const customerCountry = client.country || 'BE';
    let customerVat = client.vatNumber ? cleanVat(client.vatNumber) : undefined;
    if (customerVat && /^\d+$/.test(customerVat)) {
        customerVat = customerCountry.toUpperCase() + customerVat;
    }

    const countryLabel = customerCountry === 'BE' ? 'Belgium' : customerCountry;
    const customerAddressStr = [
        client.street,
        client.postalCode,
        client.city,
        countryLabel
    ].filter(Boolean).join(', ') || client.address || '';

    const items = flattenBlocksToLineItems(blocks || []);

    const invoicePayload: Record<string, any> = {
        document_type: isCreditNote ? 'CREDIT_NOTE' : 'INVOICE',
        invoice_id: String(invoiceTitle || invoiceId || `INV-${Date.now()}`),
        invoice_date: invoiceDate || today,
        due_date: due,
        currency: 'EUR',
        related_invoice_id: parentInvoiceNumber,

        // Vendor (Sender) — from Tenant profile
        vendor_name: tenant.companyName || 'Unknown Company',
        vendor_tax_id: vendorVat,
        vendor_address: [tenant.street, tenant.postalCode, tenant.city, 'Belgium'].filter(Boolean).join(', '),
        vendor_email: tenant.email || userEmail || '',

        // Customer (Receiver) — from selected client
        customer_name: [client.firstName, client.lastName].filter(Boolean).join(' ').trim() || client.companyName || 'Onbekende Klant',
        customer_address: customerAddressStr,
        customer_country: customerCountry,

        // Line items
        items,

        // Payment terms
        payment_term: 'Net 30 days',
    };

    if (customerVat) {
        invoicePayload.customer_tax_id = customerVat;
    }

    if (client.email) {
        invoicePayload.customer_email = client.email;
    }

    if (tenant.iban) {
        invoicePayload.payment_details = [{
            iban: tenant.iban.replace(/\s/g, ''),
            ...(tenant.bic ? { swift: tenant.bic } : {}),
            payment_reference: structuredComm || String(invoiceTitle || invoiceId || ''),
        }];
    }

    if (betreft) {
        invoicePayload.note = betreft;
    }

    return {
        invoicePayload,
        vendorVat,
        customerVat,
        customerCountry,
        customerAddressStr,
        items
    };
}

export function performLocalPreflight(params: BuildPayloadParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.tenant.companyName) {
        errors.push("Uw bedrijfsnaam ontbreekt in uw bedrijfsprofiel.");
    }
    if (!params.tenant.vatNumber) {
        errors.push("Uw BTW-nummer ontbreekt in uw bedrijfsprofiel.");
    } else {
        let cleanVendorVat = params.tenant.vatNumber.replace(/[\s.]/g, '').toUpperCase();
        if (/^\d+$/.test(cleanVendorVat)) {
            cleanVendorVat = 'BE' + cleanVendorVat;
        }
        if (!/^[A-Z]{2}\d{8,12}$/.test(cleanVendorVat)) {
            errors.push("Uw BTW-nummer heeft een ongeldig formaat.");
        }
    }

    if (!params.client) {
        errors.push("Selecteer een klant voor deze factuur.");
        return { isValid: false, errors };
    }

    const clientName = [params.client.firstName, params.client.lastName].filter(Boolean).join(' ').trim() || params.client.companyName;
    if (!clientName) {
        errors.push("Naam of bedrijfsnaam van de klant ontbreekt.");
    }

    if (params.client.vatNumber) {
        let cleanCustomerVat = params.client.vatNumber.replace(/[\s.]/g, '').toUpperCase();
        const country = params.client.country || 'BE';
        if (/^\d+$/.test(cleanCustomerVat)) {
            cleanCustomerVat = country.toUpperCase() + cleanCustomerVat;
        }
        if (!/^[A-Z]{2}\d{8,12}$/.test(cleanCustomerVat)) {
            errors.push("Het BTW-nummer van de klant heeft een ongeldig formaat. Het moet bestaan uit een landcode gevolgd door cijfers (bijv. BE0768798123).");
        }
    } else if (!params.isCreditNote) {
        // Alert that B2B Peppol requires a VAT number
        errors.push("BTW-nummer van de klant is verplicht voor B2B Peppol verzending.");
    }

    const street = params.client.street || params.client.address;
    const city = params.client.city;
    const postalCode = params.client.postalCode;
    const country = params.client.country || 'BE';

    if (!street) {
        errors.push("Straatnaam en huisnummer van de klant ontbreken.");
    }
    if (!city) {
        errors.push("Stad van de klant ontbreekt.");
    }
    if (!postalCode) {
        errors.push("Postcode van de klant ontbreekt.");
    }
    if (!country || country.length !== 2) {
        errors.push("Landcode van de klant ontbreekt of is ongeldig (moet 2 letters zijn, bijv. BE).");
    }

    const items = flattenBlocksToLineItems(params.blocks || []);
    if (items.length === 0) {
        errors.push("De factuur heeft geen geldige factuurlijnen. Voeg ten minste één product of dienst toe.");
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
