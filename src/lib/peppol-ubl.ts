/**
 * Peppol BIS Billing 3.0 UBL Invoice XML Generator
 * Generates compliant UBL 2.1 XML for the Peppol network.
 * 
 * Reference: https://docs.peppol.eu/poacc/billing/3.0/
 */

interface UBLLineItem {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    taxRate: number; // e.g. 21, 6, 0
    isReverseCharge?: boolean; // If true, sets TaxCategory AE (Btw verlegd)
}

interface UBLInvoiceData {
    invoiceId: string;
    issueDate: string;       // YYYY-MM-DD
    dueDate: string;         // YYYY-MM-DD
    currency: string;        // EUR
    type?: '380' | '381';    // 380 = Invoice, 381 = Credit Note
    parentInvoiceNumber?: string; // Mandatory for Credit Notes (381)

    // Supplier (Vendor)
    supplierName: string;
    supplierVatNumber: string; // e.g. BE1018265814
    supplierStreet?: string;
    supplierCity?: string;
    supplierPostalCode?: string;
    supplierCountry: string;  // BE
    supplierEmail?: string;

    // Customer (Buyer)
    customerName: string;
    customerVatNumber?: string;
    customerAddress?: string;
    customerEmail?: string;

    // Payment
    iban?: string;
    bic?: string;
    paymentReference?: string;
    paymentTermNote?: string;

    // Note
    note?: string;

    // Line items
    items: UBLLineItem[];
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatAmount(amount: number): string {
    return amount.toFixed(2);
}

/**
 * Parse a free-form address string into structured components.
 * Attempts: "Street 123, 1000 City, Belgium" or "Street 123, 1000 City"
 */
function parseAddress(address?: string): { street: string; city: string; postalCode: string; country: string } {
    if (!address) return { street: '', city: '', postalCode: '', country: 'BE' };

    const parts = address.split(',').map(p => p.trim());
    const street = parts[0] || '';

    // Try to extract postal code and city from second part: "1000 Brussels"
    let postalCode = '';
    let city = '';
    if (parts[1]) {
        const match = parts[1].match(/^(\d{4})\s+(.+)$/);
        if (match) {
            postalCode = match[1];
            city = match[2];
        } else {
            city = parts[1];
        }
    }

    return { street, city, postalCode, country: 'BE' };
}

/** Extract ISO 3166-1 alpha-2 country code from VAT number */
function getCountryFromVat(vat?: string): string {
    if (!vat) return 'BE';
    const match = vat.match(/^([A-Z]{2})/);
    return match ? match[1] : 'BE';
}

/** Strip country prefix from VAT number for endpoint ID */
function getEndpointId(vat: string): string {
    return vat.replace(/^[A-Z]{2}/, '');
}

export function generatePeppolUBL(data: UBLInvoiceData): string {
    const supplierCountry = getCountryFromVat(data.supplierVatNumber) || data.supplierCountry;
    const customerCountry = data.customerVatNumber ? getCountryFromVat(data.customerVatNumber) : 'BE';

    // Calculate tax breakdown
    const taxMap = new Map<number, { taxableAmount: number; taxAmount: number }>();
    let totalLineExtensionAmount = 0;

    for (const item of data.items) {
        totalLineExtensionAmount += item.lineTotal;
        const rateKey = item.isReverseCharge ? -1 : item.taxRate; // Use -1 as unique key for RC
        const existing = taxMap.get(rateKey) || { taxableAmount: 0, taxAmount: 0 };
        existing.taxableAmount += item.lineTotal;
        // Tax is 0 for Reverse Charge
        existing.taxAmount += item.isReverseCharge ? 0 : (item.lineTotal * (item.taxRate / 100));
        taxMap.set(rateKey, existing);
    }

    const totalTaxAmount = Array.from(taxMap.values()).reduce((sum, t) => sum + t.taxAmount, 0);
    const totalWithTax = totalLineExtensionAmount + totalTaxAmount;

    // Build XML
    const lines: string[] = [];
    const add = (line: string) => lines.push(line);

    add('<?xml version="1.0" encoding="UTF-8"?>');
    add('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    add('  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    add('  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');
    add('');

    // BIS 3.0 Customization
    add('  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>');
    add('  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>');
    add('');

    // Invoice metadata
    add(`  <cbc:ID>${escapeXml(data.invoiceId)}</cbc:ID>`);
    add(`  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>`);
    add(`  <cbc:DueDate>${data.dueDate}</cbc:DueDate>`);
    add(`  <cbc:InvoiceTypeCode>${data.type || '380'}</cbc:InvoiceTypeCode>`); // 380 = Invoice, 381 = Credit Note
    
    if (data.note) {
        add(`  <cbc:Note>${escapeXml(data.note)}</cbc:Note>`);
    }
    
    // Legal requirement for Reverse Charge (BE)
    const hasReverseCharge = data.items.some(i => i.isReverseCharge);
    if (hasReverseCharge) {
        add('  <cbc:Note>Btw verlegd (Reverse Charge)</cbc:Note>');
    }

    add(`  <cbc:DocumentCurrencyCode>${data.currency}</cbc:DocumentCurrencyCode>`);

    // Billing Reference (Mandatory for Credit Notes)
    if (data.type === '381' && data.parentInvoiceNumber) {
        add('  <cac:BillingReference>');
        add('    <cac:InvoiceDocumentReference>');
        add(`      <cbc:ID>${escapeXml(data.parentInvoiceNumber)}</cbc:ID>`);
        add('    </cac:InvoiceDocumentReference>');
        add('  </cac:BillingReference>');
    }
    add('');

    // ── Supplier (AccountingSupplierParty) ──
    add('  <cac:AccountingSupplierParty>');
    add('    <cac:Party>');
    // Peppol Endpoint — Belgian scheme 0208
    if (data.supplierVatNumber) {
        add(`      <cbc:EndpointID schemeID="0208">${getEndpointId(data.supplierVatNumber)}</cbc:EndpointID>`);
    }
    // Party identification
    if (data.supplierVatNumber) {
        add('      <cac:PartyIdentification>');
        add(`        <cbc:ID>${escapeXml(data.supplierVatNumber)}</cbc:ID>`);
        add('      </cac:PartyIdentification>');
    }
    // Party name
    add('      <cac:PartyName>');
    add(`        <cbc:Name>${escapeXml(data.supplierName)}</cbc:Name>`);
    add('      </cac:PartyName>');
    // Postal address
    add('      <cac:PostalAddress>');
    if (data.supplierStreet) add(`        <cbc:StreetName>${escapeXml(data.supplierStreet)}</cbc:StreetName>`);
    if (data.supplierCity) add(`        <cbc:CityName>${escapeXml(data.supplierCity)}</cbc:CityName>`);
    if (data.supplierPostalCode) add(`        <cbc:PostalZone>${escapeXml(data.supplierPostalCode)}</cbc:PostalZone>`);
    add('        <cac:Country>');
    add(`          <cbc:IdentificationCode>${supplierCountry}</cbc:IdentificationCode>`);
    add('        </cac:Country>');
    add('      </cac:PostalAddress>');
    // Tax scheme
    add('      <cac:PartyTaxScheme>');
    add(`        <cbc:CompanyID>${escapeXml(data.supplierVatNumber)}</cbc:CompanyID>`);
    add('        <cac:TaxScheme>');
    add('          <cbc:ID>VAT</cbc:ID>');
    add('        </cac:TaxScheme>');
    add('      </cac:PartyTaxScheme>');
    // Legal entity
    add('      <cac:PartyLegalEntity>');
    add(`        <cbc:RegistrationName>${escapeXml(data.supplierName)}</cbc:RegistrationName>`);
    if (data.supplierVatNumber) {
        add(`        <cbc:CompanyID>${escapeXml(data.supplierVatNumber)}</cbc:CompanyID>`);
    }
    add('      </cac:PartyLegalEntity>');
    // Contact
    if (data.supplierEmail) {
        add('      <cac:Contact>');
        add(`        <cbc:ElectronicMail>${escapeXml(data.supplierEmail)}</cbc:ElectronicMail>`);
        add('      </cac:Contact>');
    }
    add('    </cac:Party>');
    add('  </cac:AccountingSupplierParty>');
    add('');

    // ── Customer (AccountingCustomerParty) ──
    add('  <cac:AccountingCustomerParty>');
    add('    <cac:Party>');
    if (data.customerVatNumber) {
        add(`      <cbc:EndpointID schemeID="0208">${getEndpointId(data.customerVatNumber)}</cbc:EndpointID>`);
    } else if (data.customerEmail) {
        add(`      <cbc:EndpointID schemeID="EM">${escapeXml(data.customerEmail)}</cbc:EndpointID>`);
    }
    if (data.customerVatNumber) {
        add('      <cac:PartyIdentification>');
        add(`        <cbc:ID>${escapeXml(data.customerVatNumber)}</cbc:ID>`);
        add('      </cac:PartyIdentification>');
    }
    add('      <cac:PartyName>');
    add(`        <cbc:Name>${escapeXml(data.customerName)}</cbc:Name>`);
    add('      </cac:PartyName>');
    // Customer address
    const custAddr = parseAddress(data.customerAddress);
    add('      <cac:PostalAddress>');
    if (custAddr.street) add(`        <cbc:StreetName>${escapeXml(custAddr.street)}</cbc:StreetName>`);
    if (custAddr.city) add(`        <cbc:CityName>${escapeXml(custAddr.city)}</cbc:CityName>`);
    if (custAddr.postalCode) add(`        <cbc:PostalZone>${escapeXml(custAddr.postalCode)}</cbc:PostalZone>`);
    add('        <cac:Country>');
    add(`          <cbc:IdentificationCode>${customerCountry}</cbc:IdentificationCode>`);
    add('        </cac:Country>');
    add('      </cac:PostalAddress>');
    if (data.customerVatNumber) {
        add('      <cac:PartyTaxScheme>');
        add(`        <cbc:CompanyID>${escapeXml(data.customerVatNumber)}</cbc:CompanyID>`);
        add('        <cac:TaxScheme>');
        add('          <cbc:ID>VAT</cbc:ID>');
        add('        </cac:TaxScheme>');
        add('      </cac:PartyTaxScheme>');
    }
    add('      <cac:PartyLegalEntity>');
    add(`        <cbc:RegistrationName>${escapeXml(data.customerName)}</cbc:RegistrationName>`);
    add('      </cac:PartyLegalEntity>');
    if (data.customerEmail) {
        add('      <cac:Contact>');
        add(`        <cbc:ElectronicMail>${escapeXml(data.customerEmail)}</cbc:ElectronicMail>`);
        add('      </cac:Contact>');
    }
    add('    </cac:Party>');
    add('  </cac:AccountingCustomerParty>');
    add('');

    // ── Payment Means ──
    if (data.iban) {
        add('  <cac:PaymentMeans>');
        add('    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>'); // 30 = Credit transfer
        if (data.paymentReference) {
            add(`    <cbc:PaymentID>${escapeXml(data.paymentReference)}</cbc:PaymentID>`);
        }
        add('    <cac:PayeeFinancialAccount>');
        add(`      <cbc:ID>${escapeXml(data.iban)}</cbc:ID>`);
        if (data.bic) {
            add('      <cac:FinancialInstitutionBranch>');
            add(`        <cbc:ID>${escapeXml(data.bic)}</cbc:ID>`);
            add('      </cac:FinancialInstitutionBranch>');
        }
        add('    </cac:PayeeFinancialAccount>');
        add('  </cac:PaymentMeans>');
        add('');
    }

    // ── Payment Terms ──
    if (data.paymentTermNote) {
        add('  <cac:PaymentTerms>');
        add(`    <cbc:Note>${escapeXml(data.paymentTermNote)}</cbc:Note>`);
        add('  </cac:PaymentTerms>');
        add('');
    }

    // ── Tax Total ──
    add('  <cac:TaxTotal>');
    add(`    <cbc:TaxAmount currencyID="${data.currency}">${formatAmount(totalTaxAmount)}</cbc:TaxAmount>`);
    for (const [rateKey, breakdown] of taxMap.entries()) {
        const isRC = rateKey === -1;
        const displayRate = isRC ? 0 : rateKey;
        
        add('    <cac:TaxSubtotal>');
        add(`      <cbc:TaxableAmount currencyID="${data.currency}">${formatAmount(breakdown.taxableAmount)}</cbc:TaxableAmount>`);
        add(`      <cbc:TaxAmount currencyID="${data.currency}">${formatAmount(breakdown.taxAmount)}</cbc:TaxAmount>`);
        add('      <cac:TaxCategory>');
        // S = Standard, Z = Zero, AE = Reverse Charge
        add(`        <cbc:ID>${isRC ? 'AE' : (displayRate === 0 ? 'Z' : 'S')}</cbc:ID>`); 
        add(`        <cbc:Percent>${formatAmount(displayRate)}</cbc:Percent>`);
        if (isRC) {
            add('        <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>');
            add('        <cbc:TaxExemptionReason>Reverse charge</cbc:TaxExemptionReason>');
        }
        add('        <cac:TaxScheme>');
        add('          <cbc:ID>VAT</cbc:ID>');
        add('        </cac:TaxScheme>');
        add('      </cac:TaxCategory>');
        add('    </cac:TaxSubtotal>');
    }
    add('  </cac:TaxTotal>');
    add('');

    // ── Legal Monetary Total ──
    add('  <cac:LegalMonetaryTotal>');
    add(`    <cbc:LineExtensionAmount currencyID="${data.currency}">${formatAmount(totalLineExtensionAmount)}</cbc:LineExtensionAmount>`);
    add(`    <cbc:TaxExclusiveAmount currencyID="${data.currency}">${formatAmount(totalLineExtensionAmount)}</cbc:TaxExclusiveAmount>`);
    add(`    <cbc:TaxInclusiveAmount currencyID="${data.currency}">${formatAmount(totalWithTax)}</cbc:TaxInclusiveAmount>`);
    add(`    <cbc:PayableAmount currencyID="${data.currency}">${formatAmount(totalWithTax)}</cbc:PayableAmount>`);
    add('  </cac:LegalMonetaryTotal>');
    add('');

    // ── Invoice Lines ──
    data.items.forEach((item, index) => {
        const lineId = index + 1;
        add(`  <cac:InvoiceLine>`);
        add(`    <cbc:ID>${lineId}</cbc:ID>`);
        add(`    <cbc:InvoicedQuantity unitCode="${item.unit}">${item.quantity}</cbc:InvoicedQuantity>`);
        add(`    <cbc:LineExtensionAmount currencyID="${data.currency}">${formatAmount(item.lineTotal)}</cbc:LineExtensionAmount>`);
        add('    <cac:Item>');
        add(`      <cbc:Name>${escapeXml(item.description)}</cbc:Name>`);
        add('      <cac:ClassifiedTaxCategory>');
        // AE for Reverse Charge
        add(`        <cbc:ID>${item.isReverseCharge ? 'AE' : (item.taxRate === 0 ? 'Z' : 'S')}</cbc:ID>`);
        add(`        <cbc:Percent>${formatAmount(item.isReverseCharge ? 0 : item.taxRate)}</cbc:Percent>`);
        add('        <cac:TaxScheme>');
        add('          <cbc:ID>VAT</cbc:ID>');
        add('        </cac:TaxScheme>');
        add('      </cac:ClassifiedTaxCategory>');
        add('    </cac:Item>');
        add('    <cac:Price>');
        add(`      <cbc:PriceAmount currencyID="${data.currency}">${formatAmount(item.unitPrice)}</cbc:PriceAmount>`);
        add('    </cac:Price>');
        add('  </cac:InvoiceLine>');
        add('');
    });

    add('</Invoice>');

    return lines.join('\n');
}

export type { UBLInvoiceData, UBLLineItem };
