/**
 * DOC-ARCH-1 & DOC-ARCH-5 — Document Archiving Tests
 *
 * Pins:
 * 1. Key generation follows pattern: t_${tenantId}/documents/${databaseId}/${pageId}/${safeNumber}-v${version}.pdf
 * 2. Version resolution via storage.list: 0 entries -> v1, 1 entry -> v2, etc.
 * 3. cleanFileName sanitizes special characters and slashes.
 * 4. Reconstructed flag appends '-reconstructed' before .pdf extension.
 * 5. Rejects missing tenantId, databaseId, pageId, or empty buffer.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { archiveDocument, cleanFileName, DocumentArchiveError } from '../src/lib/records/document-archive.ts';
import type { StorageProvider, StoragePutResult, StorageListEntry } from '../src/lib/storage/index.ts';

class MockStorageProvider implements StorageProvider {
    public files = new Map<string, Buffer>();

    async put(key: string, data: any): Promise<StoragePutResult> {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this.files.set(key, buf);
        return { key, url: `/api/files/${key}` };
    }

    get(key: string): string {
        return `/api/files/${key}`;
    }

    async read(key: string): Promise<Buffer> {
        const buf = this.files.get(key);
        if (!buf) throw new Error(`Blob not found: ${key}`);
        return buf;
    }

    async delete(key: string): Promise<void> {
        this.files.delete(key);
    }

    async list(prefix: string): Promise<StorageListEntry[]> {
        const entries: StorageListEntry[] = [];
        for (const [k, buf] of this.files.entries()) {
            if (k.startsWith(prefix)) {
                entries.push({
                    key: k,
                    url: `/api/files/${k}`,
                    size: buf.length,
                    uploadedAt: new Date(),
                    pathname: k,
                });
            }
        }
        return entries;
    }
}

describe('cleanFileName', () => {
    test('replaces illegal characters with underscores', () => {
        assert.equal(cleanFileName('INV/2026/001'), 'INV_2026_001');
        assert.equal(cleanFileName('Factuur 2026-01 (Coral)'), 'Factuur_2026-01__Coral_');
        assert.equal(cleanFileName('INV#99*test?'), 'INV_99_test_');
    });

    test('preserves valid alphanumeric, dots, hyphens, underscores', () => {
        assert.equal(cleanFileName('INV-2026.01_v2'), 'INV-2026.01_v2');
    });
});

describe('archiveDocument', () => {
    test('archives initial document as v1 in tenant-isolated folder', async () => {
        const storage = new MockStorageProvider();
        const pdf = Buffer.from('%PDF-1.4 test invoice content');

        const result = await archiveDocument({
            tenantId: 'tenant_abc',
            databaseId: 'db_invoices',
            pageId: 'page_123',
            documentNumber: 'INV-2026/001',
            pdf,
            storageProvider: storage,
        });

        assert.equal(result.version, 1);
        assert.equal(result.filename, 'INV-2026_001-v1.pdf');
        assert.equal(result.key, 't_tenant_abc/documents/db_invoices/page_123/INV-2026_001-v1.pdf');
        assert.ok(storage.files.has(result.key));
        assert.equal(storage.files.get(result.key)?.toString(), '%PDF-1.4 test invoice content');
    });

    test('increments version on subsequent archives of the same page', async () => {
        const storage = new MockStorageProvider();
        const pdf1 = Buffer.from('v1 pdf');
        const pdf2 = Buffer.from('v2 pdf');

        const res1 = await archiveDocument({
            tenantId: 'tenant_abc',
            databaseId: 'db_invoices',
            pageId: 'page_123',
            documentNumber: 'INV-001',
            pdf: pdf1,
            storageProvider: storage,
        });
        assert.equal(res1.version, 1);
        assert.equal(res1.filename, 'INV-001-v1.pdf');

        const res2 = await archiveDocument({
            tenantId: 'tenant_abc',
            databaseId: 'db_invoices',
            pageId: 'page_123',
            documentNumber: 'INV-001',
            pdf: pdf2,
            storageProvider: storage,
        });
        assert.equal(res2.version, 2);
        assert.equal(res2.filename, 'INV-001-v2.pdf');
        assert.equal(res2.key, 't_tenant_abc/documents/db_invoices/page_123/INV-001-v2.pdf');
    });

    test('appends -reconstructed when reconstructed flag is true (DOC-ARCH-5)', async () => {
        const storage = new MockStorageProvider();
        const pdf = Buffer.from('reconstructed pdf');

        const result = await archiveDocument({
            tenantId: 'tenant_abc',
            databaseId: 'db_invoices',
            pageId: 'page_123',
            documentNumber: 'INV-001',
            pdf,
            reconstructed: true,
            storageProvider: storage,
        });

        assert.equal(result.version, 1);
        assert.equal(result.filename, 'INV-001-v1-reconstructed.pdf');
        assert.equal(result.key, 't_tenant_abc/documents/db_invoices/page_123/INV-001-v1-reconstructed.pdf');
    });

    test('throws DocumentArchiveError for empty buffer', async () => {
        const storage = new MockStorageProvider();

        await assert.rejects(
            async () => {
                await archiveDocument({
                    tenantId: 'tenant_abc',
                    databaseId: 'db_invoices',
                    pageId: 'page_123',
                    documentNumber: 'INV-001',
                    pdf: Buffer.alloc(0),
                    storageProvider: storage,
                });
            },
            DocumentArchiveError
        );
    });

    test('throws DocumentArchiveError for missing identifiers', async () => {
        const storage = new MockStorageProvider();
        const pdf = Buffer.from('pdf');

        await assert.rejects(
            async () => {
                await archiveDocument({
                    tenantId: '',
                    databaseId: 'db_invoices',
                    pageId: 'page_123',
                    documentNumber: 'INV-001',
                    pdf,
                    storageProvider: storage,
                });
            },
            DocumentArchiveError
        );
    });
});

describe('reconstruction guard (D3)', () => {
    test('identifies existing authentic archive in storage entries', () => {
        const entries: StorageListEntry[] = [
            {
                key: 't_abc/documents/db_inv/p_1/INV_001-v1.pdf',
                pathname: 't_abc/documents/db_inv/p_1/INV_001-v1.pdf',
                url: '/api/files/...',
                size: 100,
                uploadedAt: new Date()
            }
        ];
        const hasAuthentic = entries.some(e => !e.pathname.endsWith('-reconstructed.pdf'));
        assert.equal(hasAuthentic, true);
    });

    test('allows reconstruction when only reconstructed archives exist', () => {
        const entries: StorageListEntry[] = [
            {
                key: 't_abc/documents/db_inv/p_1/INV_001-v1-reconstructed.pdf',
                pathname: 't_abc/documents/db_inv/p_1/INV_001-v1-reconstructed.pdf',
                url: '/api/files/...',
                size: 100,
                uploadedAt: new Date()
            }
        ];
        const hasAuthentic = entries.some(e => !e.pathname.endsWith('-reconstructed.pdf'));
        assert.equal(hasAuthentic, false);
    });
});
