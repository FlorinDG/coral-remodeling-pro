/**
 * CHARACTERIZATION TESTS — StorageProvider contract and key resolution
 *
 * Pins:
 * 1. StorageProvider.read contract: missing key MUST throw, never return null/empty.
 * 2. streamToBuffer: converts web ReadableStream and Node streams to Buffer losslessly.
 * 3. resolveDocumentKey: resolves legacy formats, strips /api/files/, extracts Vercel blob
 *    pathnames, rejects foreign domains, enforces tenant prefix if tenantId is provided.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { streamToBuffer, resolveDocumentKey, decodeStorageKey, StorageKeyConflictError, DocumentArchivedError } from '../src/lib/storage/index.ts';
import type { StorageProvider, StoragePutResult, StorageListEntry, StoragePutOptions } from '../src/lib/storage/index.ts';

class StubStorageProvider implements StorageProvider {
    private store = new Map<string, Buffer>();

    seed(key: string, data: Buffer) {
        this.store.set(key, data);
    }

    async put(key: string, data: any, opts?: StoragePutOptions): Promise<StoragePutResult> {
        const isArchivePath = key.includes('/documents/');
        const allowOverwrite = isArchivePath ? false : (opts?.overwrite ?? false);

        if (this.store.has(key) && !allowOverwrite) {
            if (isArchivePath) throw new DocumentArchivedError();
            throw new StorageKeyConflictError();
        }
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this.store.set(key, buf);
        return { key, url: this.get(key) };
    }

    get(key: string): string {
        return `/api/files/${key}`;
    }

    async read(key: string): Promise<Buffer> {
        const data = this.store.get(key);
        if (!data) {
            throw new Error(`Blob not found or unreadable: ${key}`);
        }
        return data;
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list(prefix: string): Promise<StorageListEntry[]> {
        const entries: StorageListEntry[] = [];
        for (const [k, buf] of this.store.entries()) {
            if (k.startsWith(prefix)) {
                entries.push({
                    key: k,
                    url: this.get(k),
                    size: buf.length,
                    uploadedAt: new Date(),
                    pathname: k,
                });
            }
        }
        return entries;
    }
}

describe('StorageProvider.read — contract', () => {
    test('read on existing key returns the exact Buffer', async () => {
        const provider = new StubStorageProvider();
        const payload = Buffer.from('invoice-pdf-content');
        provider.seed('t_tenant1/invoice_101.pdf', payload);

        const result = await provider.read('t_tenant1/invoice_101.pdf');
        assert.ok(Buffer.isBuffer(result));
        assert.equal(result.toString('utf-8'), 'invoice-pdf-content');
    });

    test('read on missing key throws with descriptive error, NEVER null or empty', async () => {
        const provider = new StubStorageProvider();

        await assert.rejects(
            async () => {
                await provider.read('t_tenant1/nonexistent.pdf');
            },
            {
                name: 'Error',
                message: /Blob not found or unreadable: t_tenant1\/nonexistent\.pdf/
            }
        );
    });
});

describe('streamToBuffer', () => {
    test('converts Web ReadableStream chunks to Buffer', async () => {
        const chunk1 = new TextEncoder().encode('Hello, ');
        const chunk2 = new TextEncoder().encode('World!');
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(chunk1);
                controller.enqueue(chunk2);
                controller.close();
            }
        });

        const buf = await streamToBuffer(stream);
        assert.ok(Buffer.isBuffer(buf));
        assert.equal(buf.toString('utf-8'), 'Hello, World!');
    });

    test('throws when stream is null or empty', async () => {
        await assert.rejects(
            async () => {
                await streamToBuffer(null as any);
            },
            {
                name: 'Error',
                message: /Cannot convert empty stream to Buffer/
            }
        );
    });
});

describe('resolveDocumentKey (C1 legacy shapes)', () => {
    test('raw key starting with t_ is preserved', () => {
        const key = resolveDocumentKey('t_tenant1/receipt.pdf');
        assert.equal(key, 't_tenant1/receipt.pdf');
    });

    test('serving route URL /api/files/ is stripped to bare key', () => {
        const key = resolveDocumentKey('/api/files/t_tenant1/subfolder/receipt.pdf');
        assert.equal(key, 't_tenant1/subfolder/receipt.pdf');
    });

    test('Vercel blob URL pathname is extracted', () => {
        const url = 'https://blob.vercel-storage.com/t_tenant1/invoices/inv_001.pdf';
        const key = resolveDocumentKey(url);
        assert.equal(key, 't_tenant1/invoices/inv_001.pdf');
    });

    test('external non-blob URLs (e.g. Google Drive) return null', () => {
        const driveUrl = 'https://drive.google.com/file/d/1XPTK3Sd4KQJn2TIRzARsVeIpeNGali6O/view';
        assert.equal(resolveDocumentKey(driveUrl), null);
    });

    test('empty or whitespace strings return null', () => {
        assert.equal(resolveDocumentKey(''), null);
        assert.equal(resolveDocumentKey('   '), null);
        assert.equal(resolveDocumentKey(null), null);
        assert.equal(resolveDocumentKey(undefined), null);
    });

    test('enforces tenant prefix if tenantId is supplied', () => {
        const validKey = resolveDocumentKey('t_alpha123/receipt.pdf', 'alpha123');
        assert.equal(validKey, 't_alpha123/receipt.pdf');

        const foreignKey = resolveDocumentKey('t_other999/receipt.pdf', 'alpha123');
        assert.equal(foreignKey, null);
    });
});

describe('KERN-1 — decodeStorageKey & resolveDocumentKey decodes', () => {
    test('decodeStorageKey: decodes string key with spaces and encoded slashes', () => {
        const decoded = decodeStorageKey('t_tenant1%2Freceipts%2Fplan%202.pdf');
        assert.equal(decoded, 't_tenant1/receipts/plan 2.pdf');
    });

    test('decodeStorageKey: decodes array of path segments correctly', () => {
        const decoded = decodeStorageKey(['t_tenant1', 'receipts', 'plan%202.pdf']);
        assert.equal(decoded, 't_tenant1/receipts/plan 2.pdf');
    });

    test('decodeStorageKey: leaves already-decoded key unchanged', () => {
        const decoded = decodeStorageKey('t_tenant1/receipts/plan 2.pdf');
        assert.equal(decoded, 't_tenant1/receipts/plan 2.pdf');
    });

    test('decodeStorageKey: returns null on malformed percent sequence rather than throw', () => {
        const decoded = decodeStorageKey('t_tenant1/receipts/%ZZ.pdf');
        assert.equal(decoded, null);

        const decodedArray = decodeStorageKey(['t_tenant1', '%ZZ']);
        assert.equal(decodedArray, null);
    });

    test('resolveDocumentKey: decodes key with spaces and %2F from TicketCaptureModal format', () => {
        // TicketCaptureModal produces: /api/files/${encodeURIComponent(uploadRes.key)}
        const encodedUrl = '/api/files/t_tenant1%2Freceipts%2Fplan%202.pdf';
        const key = resolveDocumentKey(encodedUrl, 'tenant1');
        assert.equal(key, 't_tenant1/receipts/plan 2.pdf');
    });

    test('resolveDocumentKey: bare key resolves without regression', () => {
        const bareKey = 't_tenant1/receipts/a.pdf';
        assert.equal(resolveDocumentKey(bareKey, 'tenant1'), 't_tenant1/receipts/a.pdf');
    });

    test('resolveDocumentKey: foreign tenant encoded key returns null', () => {
        const foreignEncoded = '/api/files/t_other999%2Freceipts%2Fplan%202.pdf';
        assert.equal(resolveDocumentKey(foreignEncoded, 'tenant1'), null);
    });

    test('resolveDocumentKey: malformed percent sequence returns null and does not throw', () => {
        const malformedUrl = '/api/files/t_tenant1/receipts/malformed%ZZ.pdf';
        assert.equal(resolveDocumentKey(malformedUrl, 'tenant1'), null);
    });
});

describe('BLOB-7 — overwrite protection & named errors', () => {
    test('default put (overwrite: false) throws StorageKeyConflictError on existing key', async () => {
        const provider = new StubStorageProvider();
        const key = 't_tenant1/receipts/factuur.pdf';
        provider.seed(key, Buffer.from('original content'));

        await assert.rejects(
            async () => {
                await provider.put(key, Buffer.from('new content'));
            },
            (err: any) => {
                assert.ok(err instanceof StorageKeyConflictError);
                assert.equal(err.code, 'STORAGE_KEY_CONFLICT');
                return true;
            }
        );

        // Original content preserved byte-identical
        const current = await provider.read(key);
        assert.equal(current.toString('utf-8'), 'original content');
    });

    test('explicit put with overwrite: true replaces non-archive document cleanly', async () => {
        const provider = new StubStorageProvider();
        const key = 't_tenant1/purchase-invoice/page-123/factuur.pdf';
        provider.seed(key, Buffer.from('draft v1'));

        const result = await provider.put(key, Buffer.from('corrected v2'), { overwrite: true });
        assert.equal(result.key, key);

        const updated = await provider.read(key);
        assert.equal(updated.toString('utf-8'), 'corrected v2');
    });

    test('archive path /documents/ cannot be overwritten even if overwrite: true is requested', async () => {
        const provider = new StubStorageProvider();
        const archiveKey = 't_tenant1/documents/db-invoices/page-456/Factuur_001-v1.pdf';
        provider.seed(archiveKey, Buffer.from('sent and locked PDF'));

        await assert.rejects(
            async () => {
                await provider.put(archiveKey, Buffer.from('tampered content'), { overwrite: true });
            },
            (err: any) => {
                assert.ok(err instanceof DocumentArchivedError);
                assert.equal(err.code, 'DOCUMENT_ARCHIVED');
                return true;
            }
        );

        // Byte-identical guarantee for archived documents
        const preserved = await provider.read(archiveKey);
        assert.equal(preserved.toString('utf-8'), 'sent and locked PDF');
    });

    test('different filename creates separate entry without collision', async () => {
        const provider = new StubStorageProvider();
        const key1 = 't_tenant1/receipts/ticket-1.pdf';
        const key2 = 't_tenant1/receipts/ticket-2.pdf';

        await provider.put(key1, Buffer.from('ticket 1'));
        await provider.put(key2, Buffer.from('ticket 2'));

        const read1 = await provider.read(key1);
        const read2 = await provider.read(key2);
        assert.equal(read1.toString('utf-8'), 'ticket 1');
        assert.equal(read2.toString('utf-8'), 'ticket 2');
    });
});

