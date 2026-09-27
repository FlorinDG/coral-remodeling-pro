import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPortalAccess } from '@/lib/portal-auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { portalId, projectId, content, sender, fileUrl, replyToId } = body;

        if (!portalId) {
            return NextResponse.json({ error: 'Portal ID required' }, { status: 400 });
        }

        const authResult = await verifyPortalAccess(request, { portalId });
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
        }

        const message = await prisma.message.create({
            data: {
                portalId: authResult.portal.id,
                projectId,
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
