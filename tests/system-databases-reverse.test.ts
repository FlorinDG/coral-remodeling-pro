import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { roleOfDatabase } from '../src/lib/data/system-databases.ts';

test('R1-1b · roleOfDatabase is a lookup, not a parser: startsWith and split are forbidden', () => {
    const filePath = path.resolve(import.meta.dirname, '../src/lib/data/system-databases.ts');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
        !sourceCode.includes('startsWith'),
        'Forbidden: "startsWith" must not appear in src/lib/data/system-databases.ts'
    );
    assert.ok(
        !sourceCode.includes('split'),
        'Forbidden: "split" must not appear in src/lib/data/system-databases.ts'
    );
    assert.ok(
        !sourceCode.includes('slice'),
        'Forbidden: "slice" must not appear in src/lib/data/system-databases.ts'
    );
    assert.ok(
        !sourceCode.includes('substring'),
        'Forbidden: "substring" must not appear in src/lib/data/system-databases.ts'
    );
    assert.ok(
        !sourceCode.includes('indexOf'),
        'Forbidden: "indexOf" must not appear in src/lib/data/system-databases.ts'
    );
});

test('R1-1b · roleOfDatabase: nonexistent database throws', async () => {
    const mockClient = {
        globalDatabase: {
            findFirst: async () => null,
        }
    };

    await assert.rejects(
        async () => {
            await roleOfDatabase('nonexistent-tenant', 'nonexistent-db', mockClient);
        },
        /Database not found/
    );
});

test('R1-1b · roleOfDatabase: resolves system database role without string parsing', async () => {
    const mockClient = {
        globalDatabase: {
            findFirst: async ({ where }: any) => {
                if (where.id === 'db-1' && where.tenantId === 'tenant-bv-coral') {
                    return { logicalKey: 'projects' };
                }
                return null;
            }
        }
    };

    const role = await roleOfDatabase('tenant-bv-coral', 'db-1', mockClient);
    assert.equal(role, 'projects');
});

test('R1-1b · roleOfDatabase: custom database returns null', async () => {
    const mockClient = {
        globalDatabase: {
            findFirst: async ({ where }: any) => {
                if (where.id === 'custom-db-456' && where.tenantId === 'tenant-bv-coral') {
                    return { logicalKey: null };
                }
                return null;
            }
        }
    };

    const role = await roleOfDatabase('tenant-bv-coral', 'custom-db-456', mockClient);
    assert.equal(role, null);
});
