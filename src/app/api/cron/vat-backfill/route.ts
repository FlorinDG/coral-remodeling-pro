import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const invoices = await prisma.globalPage.findMany({
            where: {
                databaseId: { startsWith: 'db-invoices' }
            },
        });

        const updated = [];

        for (const invoice of invoices) {
            const props = invoice.properties as Record<string, any>;
            if (props && props.vatRegime === 'medecontractant') {
                const totalExVat = props.totalExVat || 0;
                // For medecontractant, VAT is always 0 and totalIncl === totalExcl
                props.totalVat = 0;
                props.totalIncVat = totalExVat;

                await prisma.globalPage.update({
                    where: { id: invoice.id },
                    data: { properties: props },
                });
                
                updated.push({
                    id: invoice.id,
                    oldVat: (invoice.properties as Record<string, any>)?.totalVat,
                    newVat: props.totalVat,
                    newTotalIncl: props.totalIncVat,
                });
            }
        }

        return NextResponse.json({ success: true, updatedCount: updated.length, updated });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
