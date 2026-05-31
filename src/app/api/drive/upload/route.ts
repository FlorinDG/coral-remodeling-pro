import { NextResponse } from 'next/server';
import { uploadFile, findOrCreateFolder, isFolderOwnedByTenant } from '@/lib/google-drive';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { driveFolderId: true }
        });

        if (!tenant?.driveFolderId) {
            return NextResponse.json({ error: 'Drive workspace not initialized' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        let parentId = formData.get('parentId') as string;
        const targetSubfolder = formData.get('targetSubfolder') as string;

        if (!parentId) {
            parentId = tenant.driveFolderId;
        } else {
            // Verify ownership of the parent folder to prevent cross-tenant uploads
            const isOwned = await isFolderOwnedByTenant(parentId, tenant.driveFolderId);
            if (!isOwned) {
                return NextResponse.json({ error: 'Forbidden: Access denied to this folder' }, { status: 403 });
            }
        }

        if (!file) {
            return NextResponse.json({ error: 'Missing file payload' }, { status: 400 });
        }

        // Validate Auth Configuration
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
            console.warn('[Google Drive] Aborting upload: Credentials missing from .env');
            return NextResponse.json({ error: 'Drive integration not configured' }, { status: 503 });
        }

        // Smart routing: if a categorisation subfolder is requested (e.g., "Offertes"), find or create it first.
        let finalDestinationId = parentId;
        if (targetSubfolder) {
            finalDestinationId = await findOrCreateFolder(targetSubfolder, parentId);
        }

        // Convert the File object from the Request into a Blob buffer for Google APIs
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileId = await uploadFile(file.name, file.type, buffer, finalDestinationId, tenantId);

        return NextResponse.json({ success: true, fileId });

    } catch (error: any) {
        console.error('[Drive Upload API Route Error]', error);
        return NextResponse.json({ error: error.message || 'Failed to upload to Drive' }, { status: 500 });
    }
}
