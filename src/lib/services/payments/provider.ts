/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface PaymentDetails {
    qrPayload: string;
    instructions: string;
    payUrl?: string;
}

export interface PaymentProvider {
    getPaymentDetails(invoice: any, tenant: any): Promise<PaymentDetails> | PaymentDetails;
}

function generateEpcQrPayload(companyName: string, iban: string, bic: string | undefined, amount: number, ogm: string, invoiceTitle: string) {
    const cleanOgm = (ogm || '').replace(/\D/g, '');
    const lines = [
        'BCD',
        '002',
        '1',
        'SCT',
        (bic || '').replace(/\s+/g, '').toUpperCase(),
        (companyName || '').substring(0, 70),
        (iban || '').replace(/\s+/g, '').toUpperCase(),
        `EUR${amount.toFixed(2)}`,
        '', // Purpose Code (empty)
        cleanOgm, // Structured Remittance (digits only)
        cleanOgm ? '' : (invoiceTitle || '').substring(0, 140) // Unstructured Remittance
    ];
    return lines.join('\n');
}

export class BankTransferProvider implements PaymentProvider {
    getPaymentDetails(invoice: any, tenant: any): PaymentDetails {
        const companyName = tenant.companyName || '';
        const iban = tenant.iban || '';
        const bic = tenant.bic || '';
        const total = parseFloat(String(invoice.properties?.['totalIncVat'] || invoice.properties?.['totalInclTax'] || 0));
        const ogm = invoice.properties?.['structuredComm'] || '';
        const title = invoice.properties?.['title'] || '';

        const qrPayload = generateEpcQrPayload(companyName, iban, bic, total, ogm, title);
        
        return {
            qrPayload,
            instructions: `SEPA Bank Transfer\nBeneficiary: ${companyName}\nIBAN: ${iban}\nBIC: ${bic}\nAmount: € ${total.toFixed(2)}\nReference: ${ogm || title}`
        };
    }
}

export class StripePaymentProvider implements PaymentProvider {
    async getPaymentDetails(invoice: any, tenant: any): Promise<PaymentDetails> {
        // Retrieve stored stripe checkout session URL if it exists
        const payUrl = invoice.properties?.['stripeCheckoutUrl'] as string;

        return {
            qrPayload: payUrl || '',
            payUrl: payUrl || '',
            instructions: payUrl ? 'Pay online securely with Stripe' : 'Stripe checkout link pending activation'
        };
    }
}

export function getPaymentProvider(providerType: string): PaymentProvider {
    if (providerType === 'stripe') {
        return new StripePaymentProvider();
    }
    return new BankTransferProvider();
}
