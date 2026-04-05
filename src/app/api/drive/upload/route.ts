import { NextResponse } from 'next/server';
import { uploadFile, findOrCreateFolder } from '@/lib/google-drive';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const parentId = formData.get('parentId') as string;
        const targetSubfolder = formData.get('targetSubfolder') as string;

        if (!file || !parentId) {
            return NextResponse.json({ error: 'Missing file or parent drive ID' }, { status: 400 });
        }

        // Validate Auth Configuration
        if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
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

        const fileId = await uploadFile(file.name, file.type, buffer, finalDestinationId);

        return NextResponse.json({ success: true, fileId });

    } catch (error: any) {
        console.error('[Drive Upload API Route Error]', error);
        return NextResponse.json({ error: error.message || 'Failed to upload to Drive' }, { status: 500 });
    }
}
