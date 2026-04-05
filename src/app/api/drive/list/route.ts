import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/google-drive';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get('folderId');

        if (!folderId) {
            return NextResponse.json({ error: 'Missing folderId parameter' }, { status: 400 });
        }

        if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Drive integration not configured' }, { status: 503 });
        }

        const files = await listFiles(folderId);

        return NextResponse.json({ success: true, files });

    } catch (error: any) {
        console.error('[Drive List API Route Error]', error);
        return NextResponse.json({ error: error.message || 'Failed to list Drive files' }, { status: 500 });
    }
}
