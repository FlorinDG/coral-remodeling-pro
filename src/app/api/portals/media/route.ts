import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { portalId, url, caption } = body;

        const media = await prisma.projectMedia.create({
            data: {
                portalId,
                url,
                caption,
                type: body.type || 'IMAGE'
            }
        });

        return NextResponse.json(media);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add media' }, { status: 500 });
    }
}
