/* eslint-disable @typescript-eslint/no-explicit-any */
import { chargedLines, splitDocumentDiscount, discountOf, type Discount, type DocLine } from '@/lib/records/document-lines';

export interface InvoiceLinePayload {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    amount: number;
    tax_rate: string;
    isReverseCharge?: boolean;
}

/** A document block as the send reads it — the line rule's fields (lib/records/document-lines) + what a line says. */
export interface InvoiceBlock extends DocLine {
    id: string;
    type: string;
    content: string;
    unit?: string;
    children?: InvoiceBlock[];
}

/** A discount on the whole document, as the e-invoice states it: an allowance before VAT, at the document's rate. */
export interface DocumentAllowance {
    amount: number;
    tax_rate: string;
    tax_code: 'S' | 'Z' | 'AE';
    reason: string;
    reason_code: string;
}

export interface BuildPayloadParams {
    invoiceId: string;
    blocks: InvoiceBlock[];
    client: any;
    invoiceTitle: string;
    betreft?: string;
    invoiceDate?: string;
    dueDate?: string;
    vatRegime?: string;
    /** The document's prices are entered incl. VAT — the send states them excl. */
    vatIncluded?: boolean;
    /** DOC-LINES-1: the discount on the total (before VAT). */
    documentDiscount?: Discount | null;
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
    pdfBase64?: string;
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

/** Normalizes country name strings to 2-letter ISO 3166-1 alpha-2 codes */
export function normalizeCountryToCode(country?: string): string {
    if (!country) return 'BE';
    const clean = country.trim().toUpperCase();
    if (clean.length === 2) return clean; // Already a 2-letter code
    
    const map: Record<string, string> = {
        'BELGIË': 'BE', 'BELGIE': 'BE', 'BELGIQUE': 'BE', 'BELGIUM': 'BE',
        'NEDERLAND': 'NL', 'NETHERLANDS': 'NL', 'PAYS-BAS': 'NL',
        'FRANKRIJK': 'FR', 'FRANCE': 'FR',
        'DUITSLAND': 'DE', 'GERMANY': 'DE', 'ALLEMAGNE': 'DE',
        'VERENIGD KONINKRIJK': 'GB', 'UNITED KINGDOM': 'GB', 'UK': 'GB',
        'LUXEMBURG': 'LU', 'LUXEMBOURG': 'LU',
    };
    return map[clean] || 'BE'; // Fallback to BE
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** The document's ONE VAT rate (Florin 2026-10-09: "vat per line is a no go. ONLY at the end"). */
function documentRate(vatRegime?: string): { rate: number; isReverseCharge: boolean } {
    if (vatRegime === 'medecontractant') return { rate: 0, isReverseCharge: true };
    const r = parseFloat(vatRegime || '21');
    return { rate: Number.isFinite(r) ? r : 21, isReverseCharge: false };
}

/**
 * The document's charged lines as e-invoice.be line items — through the ONE line rule (lib/records/document-lines),
 * so the send says what the editor, the totals and the PDF say: a line with subcomponents is one line at their sum,
 * the variant surcharge counts, a "post" multiplies its lines. A line goes out at its NET price (BT-146: after its
 * customer discount), excl. VAT, at the document's rate. Optional lines are not charged.
 */
export function flattenBlocksToLineItems(blocks: InvoiceBlock[], opts: { vatRegime?: string; vatIncluded?: boolean } = {}): InvoiceLinePayload[] {
    const { rate, isReverseCharge } = documentRate(opts.vatRegime);
    const toBase = (v: number) => (opts.vatIncluded ? v / (1 + rate / 100) : v);
    const items: InvoiceLinePayload[] = [];
    for (const l of chargedLines(blocks)) {
        const block = l.block as InvoiceBlock;
        if (l.gross === 0 && !block.content) continue; // skip empty lines
        const net = toBase(l.net);
        items.push({
            description: block.content || 'Dienstverlening',
            quantity: l.quantity,
            unit: mapUnitToCode(block.unit),
            unit_price: round4(net / (l.quantity || 1)),
            amount: round2(net),
            tax_rate: rate.toFixed(2),
            isReverseCharge,
        });
    }
    return items;
}

/** The discount on the total as the e-invoice's allowance(s): before VAT, at the document's rate (UNCL5189 95 = discount). */
export function documentAllowances(items: InvoiceLinePayload[], documentDiscount: Discount | null | undefined, vatRegime?: string): DocumentAllowance[] {
    const { rate, isReverseCharge } = documentRate(vatRegime);
    const base = items.reduce((s, i) => s + i.amount, 0);
    const split = splitDocumentDiscount(new Map([[rate, base]]), discountOf(documentDiscount));
    return [...split.byRate.entries()].filter(([, amount]) => amount > 0).map(([r, amount]) => ({
        amount,
        tax_rate: r.toFixed(2),
        tax_code: isReverseCharge ? 'AE' : r === 0 ? 'Z' : 'S',
        reason: 'Korting',
        reason_code: '95',
    }));
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
        userEmail,
        pdfBase64
    } = params;

    const today = new Date().toISOString().split('T')[0];
    const due = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const cleanVat = (vat: string) => vat.replace(/[\s.]/g, '').toUpperCase();
    let vendorVat = tenant.vatNumber ? cleanVat(tenant.vatNumber) : '';
    if (vendorVat && /^\d+$/.test(vendorVat)) {
        vendorVat = 'BE' + vendorVat;
    }

    const customerCountry = normalizeCountryToCode(client.country);
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

    const items = flattenBlocksToLineItems(blocks || [], { vatRegime: params.vatRegime, vatIncluded: params.vatIncluded });
    const allowances = documentAllowances(items, params.documentDiscount, params.vatRegime);

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
        // DOC-LINES-1: the discount on the total — an allowance with VAT impact (not total_discount, which is the
        // non-VAT financial discount)
        ...(allowances.length ? { allowances } : {}),

        // Payment terms
        payment_term: 'Net 30 days',
    };

    if (params.vatRegime === 'medecontractant') {
        invoicePayload.tax_code = 'AE';
        invoicePayload.vatex = 'VATEX-EU-AE';
        invoicePayload.vatex_note = 'Reverse charge - Art. 196 EU VAT Directive';
    }

    if (pdfBase64) {
        invoicePayload.attachments = [
            {
                file_name: `${String(invoiceTitle || invoiceId)}.pdf`,
                file_type: 'application/pdf',
                file_data: pdfBase64
            }
        ];
    }

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
        items,
        allowances
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
        const country = normalizeCountryToCode(params.client.country);
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
    const country = normalizeCountryToCode(params.client.country);

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

    const items = flattenBlocksToLineItems(params.blocks || [], { vatRegime: params.vatRegime, vatIncluded: params.vatIncluded });
    if (items.length === 0) {
        errors.push("De factuur heeft geen geldige factuurlijnen. Voeg ten minste één product of dienst toe.");
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
