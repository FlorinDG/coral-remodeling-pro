import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { verifyPortalAccess } from '@/lib/portal-auth';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const portalId = formData.get('portalId') as string;
        const projectId = formData.get('projectId') as string | null;
        const password = formData.get('password') as string | null;
        const caption = formData.get('caption') as string;
        const files = formData.getAll('file') as File[];

        if (!portalId || files.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify Portal access via unified helper
        const authResult = await verifyPortalAccess(request, { portalId, explicitPassword: password });
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
        }

        const portal = authResult.portal;
        const uploadedMedia = [];

        for (const file of files) {
            // Upload to Blob
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `t_${portal.tenantId}/portal/${portal.id}/media/${Date.now()}-${safeName}`;
            
            const blob = await storage.put(path, file, { contentType: file.type });

            // Save to DB
            const projectMedia = await prisma.projectMedia.create({
                data: {
                    portalId: portal.id,
                    projectId: projectId || null,
                    url: blob.url,
                    caption: caption || null,
                    type: 'IMAGE'
                }
            });

            uploadedMedia.push(projectMedia);
        }

        return NextResponse.json({ success: true, media: uploadedMedia });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
    }
}
