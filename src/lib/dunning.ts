import prisma from '@/lib/prisma';
import { getStripeInstance, syncPlanToTenant } from '@/lib/stripe';

/**
 * Checks all tenants that are PAST_DUE.
 * If their latest open invoice is older than the grace period (14 days),
 * it downgrades them to FREE.
 */
export async function checkAndLockPastDueSubscriptions() {
    const stripe = getStripeInstance();
    let lockedCount = 0;

    const pastDueTenants = await prisma.tenant.findMany({
        where: { subscriptionStatus: 'PAST_DUE', stripeCustomerId: { not: null } },
        select: { id: true, stripeCustomerId: true, companyName: true, planType: true }
    });

    for (const tenant of pastDueTenants) {
        if (tenant.planType === 'FREE') continue; // already downgraded

        try {
            const invoices = await stripe.invoices.list({
                customer: tenant.stripeCustomerId!,
                status: 'open',
                limit: 1,
            });

            if (invoices.data.length > 0) {
                const invoice = invoices.data[0];
                const createdDate = new Date(invoice.created * 1000);
                const daysPast = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

                if (daysPast > 14) {
                    console.log(`[Dunning] Locking out tenant ${tenant.companyName} (${tenant.id}) - PAST_DUE for ${Math.round(daysPast)} days`);
                    
                    // Downgrade to FREE to lock them out of PRO modules.
                    // We keep subscriptionStatus as PAST_DUE so UI can show a prompt.
                    await syncPlanToTenant(tenant.id, 'FREE', { subscriptionStatus: 'PAST_DUE' });
                    lockedCount++;
                }
            }
        } catch (error) {
            console.error(`[Dunning] Failed to check tenant ${tenant.id}:`, error);
        }
    }

    return { locked: lockedCount };
}
