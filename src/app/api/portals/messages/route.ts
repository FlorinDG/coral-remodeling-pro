import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        const tenantId = (session?.user as any)?.tenantId;
        if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        const { portalId, content, sender, fileUrl, replyToId } = body;

        const message = await prisma.message.create({
            data: {
                portalId,
                content,
                sender,
                fileUrl,
                replyToId
            }
        });

        return NextResponse.json(message);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
