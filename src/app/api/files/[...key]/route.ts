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
        const blob = await get(key, { token });

        if (!blob || !blob.url) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // If the fetch returns a readable stream body, we can just proxy it back
        // @vercel/blob `get` actually doesn't return the raw stream directly by default without fetch
        // Wait, @vercel/blob 0.23 introduced get() that returns a body stream if the blob exists.
        if (blob && (blob as any).body) {
            const headers = new Headers();
            if (blob.contentDisposition) headers.set('Content-Disposition', blob.contentDisposition);
            if (blob.cacheControl) headers.set('Cache-Control', blob.cacheControl);
            
            // Reconstruct content type from headers or extension if missing
            // Vercel blob get returns headers but we just pipe the body
            return new NextResponse((blob as any).body, {
                status: 200,
                headers,
            });
        } else {
            // Fallback for older versions or if body is not exposed: fetch the URL directly
            // since it's a private blob, we can't fetch it without auth, but fetch(blob.url) works
            // if we don't need a token for the downloadUrl? 
            // Wait, downloadUrl is pre-signed.
            const fetchRes = await fetch(blob.downloadUrl);
            if (!fetchRes.ok) {
                return NextResponse.json({ error: 'File not found upstream' }, { status: 404 });
            }
            
            return new NextResponse(fetchRes.body, {
                status: 200,
                headers: fetchRes.headers
            });
        }
    } catch (e: any) {
        console.error('Error serving blob:', e);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
