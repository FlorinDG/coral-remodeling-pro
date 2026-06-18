import { put, del, list as vercelList } from '@vercel/blob';

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

    async delete(key: string): Promise<void> {
        await del(key, { token: this.token });
    }

    async list(prefix: string): Promise<StorageListEntry[]> {
        let hasMore = true;
        let cursor: string | undefined = undefined;
        const entries: StorageListEntry[] = [];

        while (hasMore) {
            const listResult = await vercelList({
                prefix,
                token: this.token,
                cursor
            });

            entries.push(...listResult.blobs.map(b => ({
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
