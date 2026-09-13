import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { get } from '@vercel/blob';

export const runtime = 'nodejs'; // Use Node.js runtime for large file streaming

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ key: string[] }> }
) {
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const rawKeySegments = resolvedParams.key;

    if (!rawKeySegments || rawKeySegments.length === 0) {
        return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    // Decode each segment to correctly reconstruct the key with spaces, etc.
    const key = rawKeySegments.map(segment => decodeURIComponent(segment)).join('/');
    
    // (b) asserts the requested key startsWith t_{sessionTenantId}/ — reject otherwise
    // This is the identity-check that replaces Drive's isFolderOwnedByTenant parent-walk; one prefix assert, fail-closed
    const requiredPrefix = `t_${tenantId}/`;
    
    if (!key.startsWith(requiredPrefix)) {
        return NextResponse.json({ error: 'Forbidden: You do not have access to this file' }, { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        console.error('BLOB_READ_WRITE_TOKEN is missing');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const result = await get(key, { token, access: 'private' });

        if (!result || !result.blob) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const headers = new Headers();
        if (result.blob.cacheControl) headers.set('Cache-Control', result.blob.cacheControl);
        
        const rawFilename = key.split('/').pop() || 'file';
        const sanitizedFilename = rawFilename.replace(/["\r\n\\]/g, '_');
        const contentType = result.blob.contentType || 'application/octet-stream';
        headers.set('Content-Type', contentType);

        const isExplicitDownload = request.nextUrl.searchParams.get('download') === '1';
        const isRenderable = 
            contentType.startsWith('image/') ||
            contentType === 'application/pdf' ||
            contentType.startsWith('text/') ||
            /\.(jpe?g|png|webp|gif|svg|bmp|ico|avif|pdf|txt|md|csv|json)$/i.test(sanitizedFilename);

        if (!isExplicitDownload && isRenderable) {
            headers.set('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
        } else {
            headers.set('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        }
        
        return new NextResponse(result.stream, {
            status: 200,
            headers,
        });
    } catch (e: any) {
        console.error('Error serving blob:', e);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
