"use server";

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import Stripe from 'stripe';

export async function createInvoiceCheckout(invoiceId: string) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            throw new Error('Unauthorized');
        }

        // Get tenant details
        const tenant = await (prisma.tenant as any).findUnique({
            where: { id: tenantId }
        });
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.paymentProvider !== 'stripe' || !tenant.stripeSecretKey) {
            throw new Error('Stripe payments not configured for this workspace.');
        }

        // Decrypt key
        const decryptedKey = decrypt(tenant.stripeSecretKey);
        if (!decryptedKey) {
            throw new Error('Stripe configuration is invalid.');
        }

        // Get invoice page details
        const page = await (prisma.globalPage as any).findUnique({
            where: { id: invoiceId }
        });
        if (!page) {
            throw new Error('Invoice not found');
        }

        const props = page.properties as Record<string, any>;
        const totalIncVat = parseFloat(String(props.totalIncVat || props.totalInclTax || 0));
        const invoiceTitle = props.title || 'Invoice';
        const clientName = props.clientName || 'Client';

        if (totalIncVat <= 0) {
            throw new Error('Invoice total must be greater than € 0.');
        }

        // Initialize stripe with tenant's decrypted secret key
        const stripe = new Stripe(decryptedKey, {
            apiVersion: '2022-11-15' as any
        });

        // Get base URL for redirects
        const baseUrl = process.env.NEXTAUTH_URL || 'https://app.coral-group.be';

        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'bancontact'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `${invoiceTitle} - ${clientName}`,
                        },
                        unit_amount: Math.round(totalIncVat * 100), // in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            metadata: {
                invoiceId,
                tenantId
            },
            success_url: `${baseUrl}/public/payments/success?invoiceId=${invoiceId}`,
            cancel_url: `${baseUrl}/public/payments/cancel?invoiceId=${invoiceId}`,
        });

        const stripeCheckoutUrl = checkoutSession.url;
        if (!stripeCheckoutUrl) {
            throw new Error('Stripe session creation failed.');
        }

        // Update invoice properties in database
        const updatedProps = {
            ...props,
            stripeCheckoutUrl
        };

        await (prisma.globalPage as any).update({
            where: { id: invoiceId },
            data: {
                properties: updatedProps
            }
        });

        return { success: true, url: stripeCheckoutUrl };
    } catch (error: any) {
        console.error('[Stripe Payment] Error creating checkout session:', error);
        return { success: false, error: error.message || 'Failed to create payment session.' };
    }
}
