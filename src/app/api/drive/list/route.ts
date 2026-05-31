import { NextResponse } from 'next/server';
import { listFiles, isFolderOwnedByTenant } from '@/lib/google-drive';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get('folderId');

        if (!folderId) {
            return NextResponse.json({ error: 'Missing folderId parameter' }, { status: 400 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { driveFolderId: true }
        });

        if (!tenant?.driveFolderId) {
            return NextResponse.json({ error: 'Drive workspace not initialized' }, { status: 403 });
        }

        // Verify folder ownership for strict isolation
        const isOwned = await isFolderOwnedByTenant(folderId, tenant.driveFolderId);
        if (!isOwned) {
            return NextResponse.json({ error: 'Forbidden: Access denied to this folder' }, { status: 403 });
        }

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
            return NextResponse.json({ error: 'Drive integration not configured' }, { status: 503 });
        }

        const files = await listFiles(folderId);

        return NextResponse.json({ success: true, files });

    } catch (error: any) {
        console.error('[Drive List API Route Error]', error);
        return NextResponse.json({ error: error.message || 'Failed to list Drive files' }, { status: 500 });
    }
}
