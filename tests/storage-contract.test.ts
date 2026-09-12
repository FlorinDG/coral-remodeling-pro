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
import { streamToBuffer, resolveDocumentKey } from '../src/lib/storage/index.ts';
import type { StorageProvider, StoragePutResult, StorageListEntry } from '../src/lib/storage/index.ts';

class StubStorageProvider implements StorageProvider {
    private store = new Map<string, Buffer>();

    seed(key: string, data: Buffer) {
        this.store.set(key, data);
    }

    async put(key: string, data: any): Promise<StoragePutResult> {
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
