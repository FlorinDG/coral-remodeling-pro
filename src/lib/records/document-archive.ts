import { storage, type StorageProvider } from '@/lib/storage';

export interface ArchiveResult {
    key: string;
    version: number;
    filename: string;
}

/**
 * Sanitises documentNumber for filenames matching financials/export/route.ts:cleanFileName.
 */
export function cleanFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

export class DocumentArchiveError extends Error {
    public cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'DocumentArchiveError';
        this.cause = cause;
    }
}

/**
 * Persists an issued document to tenant-isolated storage.
 * Invariant: Never overwrites an existing key; counts existing entries to determine version vN.
 */
export async function archiveDocument(params: {
    tenantId: string;
    databaseId: string;
    pageId: string;
    documentNumber: string; // properties.title
    pdf: Buffer;
    reconstructed?: boolean; // DOC-ARCH-5 only
    storageProvider?: StorageProvider;
}): Promise<ArchiveResult> {
    const { tenantId, databaseId, pageId, documentNumber, pdf, reconstructed, storageProvider = storage } = params;

    if (!tenantId || !databaseId || !pageId) {
        throw new DocumentArchiveError(
            `[DocumentArchive] Missing required identifier: tenantId='${tenantId}', databaseId='${databaseId}', pageId='${pageId}'`
        );
    }

    if (!pdf || pdf.length === 0) {
        throw new DocumentArchiveError(
            `[DocumentArchive] Cannot archive empty PDF buffer for document '${documentNumber}' (pageId: ${pageId})`
        );
    }

    try {
        const rawName = documentNumber?.trim() || 'document';
        const safeNumber = cleanFileName(rawName) || 'document';
        const prefix = `t_${tenantId}/documents/${databaseId}/${pageId}/`;

        // Version resolution: count existing blobs in page folder
        const existingEntries = await storageProvider.list(prefix);
        const version = existingEntries.length + 1;
        const filename = `${safeNumber}-v${version}${reconstructed ? '-reconstructed' : ''}.pdf`;
        const key = `${prefix}${filename}`;

        const result = await storageProvider.put(key, pdf, { contentType: 'application/pdf' });
        if (!result?.key) {
            throw new DocumentArchiveError(`[DocumentArchive] Storage put failed to return a key for '${key}'`);
        }

        return {
            key: result.key,
            version,
            filename,
        };
    } catch (err: any) {
        if (err instanceof DocumentArchiveError) throw err;
        console.error('[DocumentArchive] Error during archive operation:', err);
        throw new DocumentArchiveError(
            `[DocumentArchive] Archiving failed for '${documentNumber}': ${err?.message || String(err)}`,
            err
        );
    }
}
