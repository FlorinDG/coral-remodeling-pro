import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { storage } from '@/lib/storage';

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

        // Verify Portal
        const portal = await prisma.clientPortal.findUnique({
            where: { id: portalId },
        });

        if (!portal) {
            return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
        }

        if (portal.password) {
            if (!password) {
                return NextResponse.json({ error: 'Password required' }, { status: 401 });
            }
            const isValid = await bcrypt.compare(password, portal.password);
            if (!isValid) {
                return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
            }
        }

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
                    type: 'IMAGE' // Defaulting to IMAGE, could inspect file.type
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
