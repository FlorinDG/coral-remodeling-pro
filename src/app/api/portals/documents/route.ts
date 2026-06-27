import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { storage } from '@/lib/storage';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const portalId = formData.get('portalId') as string;
        const password = formData.get('password') as string | null;
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

        const uploadedDocs = [];

        for (const file of files) {
            // Upload to Blob
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `t_${portal.tenantId}/portal/${portal.id}/documents/${Date.now()}-${safeName}`;
            
            const blob = await storage.put(path, file, { contentType: file.type });

            // Save to DB
            const document = await prisma.document.create({
                data: {
                    portalId: portal.id,
                    url: blob.url,
                    name: file.name,
                    type: file.type || 'application/octet-stream'
                }
            });

            uploadedDocs.push(document);
        }

        return NextResponse.json({ success: true, documents: uploadedDocs });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to upload documents' }, { status: 500 });
    }
}
