import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPaymentPlan, updatePaymentPlanAction } from '@/lib/services/payment-plan-service';
import { PaymentPlan } from '@/components/admin/database/types';

export async function GET() {
    try {
        // Find any quotation in db-quotations
        const testQuote = await prisma.globalPage.findFirst({
            where: {
                database: {
                    name: {
                        contains: 'Quotation'
                    }
                }
            }
        });

        if (!testQuote) {
            return NextResponse.json({ success: false, error: 'No test quotation found in the database.' });
        }

        const originalPlan = getPaymentPlan(testQuote.properties);

        const samplePlan: PaymentPlan = {
            method: 'bank_transfer',
            terms: {
                dueModel: 'net',
                dueDays: 14,
                lateClause: 'Statutory interest applies.'
            },
            schedule: [
                {
                    label: 'Voorschot',
                    trigger: 'milestone',
                    basis: 'percent',
                    value: 30,
                    dueOffset: 0,
                    status: 'planned'
                },
                {
                    label: 'Bij oplevering',
                    trigger: 'progress',
                    basis: 'percent',
                    value: 70,
                    dueOffset: 14,
                    status: 'planned'
                }
            ],
            deposit: 0
        };

        // Write sample plan
        const writeResult = await updatePaymentPlanAction(testQuote.id, samplePlan);
        if (!writeResult.success) {
            return NextResponse.json({ success: false, error: 'Write failed: ' + writeResult.error });
        }

        // Fetch back and verify
        const reFetched = await prisma.globalPage.findUnique({
            where: { id: testQuote.id },
            select: { properties: true }
        });

        const readPlan = getPaymentPlan(reFetched?.properties);

        // Restore original plan if it existed
        if (originalPlan) {
            await updatePaymentPlanAction(testQuote.id, originalPlan);
        } else {
            // Remove the test plan
            const currentProps = typeof reFetched?.properties === 'object' && reFetched?.properties !== null
                ? (reFetched.properties as Record<string, unknown>)
                : {};
            const { 'prop-payment-plan': _, ...rest } = currentProps;
            await prisma.globalPage.update({
                where: { id: testQuote.id },
                data: { properties: rest as any }
            });
        }

        return NextResponse.json({
            success: true,
            originalPlanPresent: !!originalPlan,
            writtenPlan: samplePlan,
            readPlan: readPlan,
            match: JSON.stringify(samplePlan) === JSON.stringify(readPlan)
        });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
    }
}
