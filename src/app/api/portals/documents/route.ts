import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { portalId, name, url, type } = body;

        const document = await prisma.document.create({
            data: {
                portalId,
                name,
                url,
                type
            }
        });

        return NextResponse.json(document);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add document' }, { status: 500 });
    }
}
