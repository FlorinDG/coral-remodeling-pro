import prisma from '@/lib/prisma';
import { PaymentPlan } from '@/components/admin/database/types';

/**
 * Extract PaymentPlan from a page's properties object.
 */
export function getPaymentPlan(properties: unknown): PaymentPlan | null {
    if (!properties || typeof properties !== 'object') return null;
    const props = properties as Record<string, unknown>;
    const plan = props['prop-payment-plan'];
    if (!plan || typeof plan !== 'object') return null;
    return plan as PaymentPlan;
}

/**
 * Persist PaymentPlan to the database for a given page.
 */
export async function updatePaymentPlanAction(pageId: string, plan: PaymentPlan) {
    try {
        const page = await prisma.globalPage.findUnique({
            where: { id: pageId },
            select: { properties: true }
        });
        
        if (!page) {
            return { success: false, error: 'Document not found.' };
        }

        const currentProps = typeof page.properties === 'object' && page.properties !== null
            ? (page.properties as Record<string, unknown>)
            : {};

        await prisma.globalPage.update({
            where: { id: pageId },
            data: {
                properties: {
                    ...currentProps,
                    'prop-payment-plan': plan as any
                }
            }
        });

        return { success: true };
    } catch (err: any) {
        console.error('[updatePaymentPlanAction] Error:', err);
        return { success: false, error: err.message || 'Failed to update payment plan.' };
    }
}
