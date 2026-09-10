import { put, del, list as vercelList, get } from '@vercel/blob';

export async function streamToBuffer(stream: ReadableStream | NodeJS.ReadableStream | any): Promise<Buffer> {
    if (!stream) {
        throw new Error('Cannot convert empty stream to Buffer');
    }
    // Web ReadableStream (ReadableStreamDefaultReader)
    if ('getReader' in stream && typeof (stream as any).getReader === 'function') {
        const reader = (stream as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                totalLength += value.length;
            }
        }
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return Buffer.from(result.buffer);
    }

    // Node.js stream
    const chunks: any[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Normalizes document storage keys across legacy formats (C1):
 * - "t_<tenantId>/..." -> trimmed key
 * - "/api/files/..." -> strips prefix
 * - "https://...public.blob.vercel-storage.com/t_.../..." -> extracts pathname
 * - Invalid/unresolvable URLs -> returns null
 * 
 * If tenantId is supplied, validates that the resolved key starts with `t_${tenantId}/`.
 */
export function resolveDocumentKey(value: string | null | undefined, tenantId?: string): string | null {
    if (!value || typeof value !== 'string') return null;
    let key = value.trim();
    if (!key) return null;

    if (key.startsWith('/api/files/')) {
        key = key.replace(/^\/api\/files\//, '');
    } else if (key.startsWith('http://') || key.startsWith('https://')) {
        try {
            const parsed = new URL(key);
            const pathname = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
            if (pathname.startsWith('t_')) {
                key = pathname;
            } else {
                return null;
            }
        } catch {
            return null;
        }
    }

    if (tenantId && !key.startsWith(`t_${tenantId}/`)) {
        return null;
    }

    return key;
}

export interface StoragePutOptions {
    contentType?: string;
}

export interface StoragePutResult {
    key: string;
    url: string;
}

export interface StorageListEntry {
    key: string;
    url: string;
    size: number;
    uploadedAt: Date;
    pathname: string;
}

export interface StorageProvider {
    put(key: string, data: string | Buffer | Blob | ArrayBuffer | ReadableStream, opts?: StoragePutOptions): Promise<StoragePutResult>;
    get(key: string): string; // Returns the serving URL (/api/files/...)
    read(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    list(prefix: string): Promise<StorageListEntry[]>;
}

/**
 * StorageProvider implementation using Vercel Blob (Private).
 * 
 * Tenant Isolation:
 * Records store the KEY, never a URL.
 * Reads go through the authenticated GET /api/files/[...key] serving route.
 */
export class BlobStorageProvider implements StorageProvider {
    private token: string;

    constructor() {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            console.warn('BLOB_READ_WRITE_TOKEN is not defined in environment.');
        }
        this.token = process.env.BLOB_READ_WRITE_TOKEN || '';
    }

    async put(key: string, data: string | Buffer | Blob | ArrayBuffer | ReadableStream, opts?: StoragePutOptions): Promise<StoragePutResult> {
        const result = await put(key, data, {
            access: 'private',
            token: this.token,
            contentType: opts?.contentType,
            addRandomSuffix: false // We use our own keys
        });

        return {
            key: result.pathname,
            url: this.get(result.pathname)
        };
    }

    get(key: string): string {
        // Files are served through our authenticated route
        return `/api/files/${key}`;
    }

    async read(key: string): Promise<Buffer> {
        const result = await get(key, { token: this.token, access: 'private' });
        if (!result?.stream) throw new Error(`Blob not found or unreadable: ${key}`);
        return await streamToBuffer(result.stream);
    }

    async delete(key: string): Promise<void> {
        await del(key, { token: this.token });
    }

    async list(prefix: string): Promise<StorageListEntry[]> {
        let hasMore = true;
        let cursor: string | undefined = undefined;
        const entries: StorageListEntry[] = [];

        while (hasMore) {
            const listResult: any = await vercelList({
                prefix,
                token: this.token,
                cursor
            });

            entries.push(...listResult.blobs.map((b: any) => ({
                key: b.pathname,
                url: this.get(b.pathname),
                size: b.size,
                uploadedAt: b.uploadedAt,
                pathname: b.pathname
            })));

            hasMore = listResult.hasMore;
            cursor = listResult.cursor;
        }

        return entries;
    }
}

// Default export instance
export const storage = new BlobStorageProvider();
