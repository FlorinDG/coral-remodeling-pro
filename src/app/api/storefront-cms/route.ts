import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Storefront CMS content is stored in SiteContent with keys prefixed with "storefront."
// Each locale gets its own value column (valueEn, valueNl, valueFr).
// Uses the same tenantId-scoped pattern as the main website CMS.

const PREFIX = 'storefront.';

export async function GET() {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({}, { status: 401 });

        const rows = await prisma.siteContent.findMany({
            where: { tenantId, key: { startsWith: PREFIX } }
        });

        // Build a nested { locale: { key: value } } map
        const result: Record<string, Record<string, string>> = { nl: {}, fr: {}, en: {} };

        for (const row of rows) {
            const cleanKey = row.key.replace(PREFIX, '');
            if (row.valueNl) result.nl[cleanKey] = row.valueNl;
            if (row.valueFr) result.fr[cleanKey] = row.valueFr;
            if (row.valueEn) result.en[cleanKey] = row.valueEn;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[storefront-cms] GET error:', error);
        return NextResponse.json({}, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body: Record<string, Record<string, string>> = await req.json();

        // Collect all unique keys across all locales
        const allKeys = new Set<string>();
        for (const locale of ['nl', 'fr', 'en'] as const) {
            if (body[locale]) {
                for (const key of Object.keys(body[locale])) {
                    allKeys.add(key);
                }
            }
        }

        // Upsert each key using the tenantId_key compound unique
        for (const key of allKeys) {
            const dbKey = `${PREFIX}${key}`;
            await prisma.siteContent.upsert({
                where: { tenantId_key: { tenantId, key: dbKey } },
                create: {
                    key: dbKey,
                    valueEn: body.en?.[key] || '',
                    valueNl: body.nl?.[key] || '',
                    valueFr: body.fr?.[key] || '',
                    valueRo: '',
                    tenantId,
                },
                update: {
                    valueEn: body.en?.[key] || '',
                    valueNl: body.nl?.[key] || '',
                    valueFr: body.fr?.[key] || '',
                },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[storefront-cms] POST error:', error);
        return NextResponse.json({ error: 'Save failed' }, { status: 500 });
    }
}
