import { test, describe } from 'node:test';
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

describe('R1-1b · roleOfDatabase client queries', { todo: 'needs an integration harness' }, () => {
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
});

test('R1-1c · source code invariant: provisionTenantDbs writes logicalKey at birth and verifies bindings', () => {
    const filePath = path.resolve(import.meta.dirname, '../src/lib/provisionTenantDbs.ts');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
        sourceCode.includes('logicalKey: role'),
        'Forbidden: provisionLockedDatabases must write logicalKey: role at birth in create'
    );
    assert.ok(
        sourceCode.includes('findMany'),
        'Forbidden: provisionLockedDatabases must verify existing bindings via findMany'
    );
    assert.ok(
        sourceCode.includes('console.warn'),
        'Forbidden: provisionLockedDatabases must report repaired dangling bindings via console.warn'
    );
});

test('KERN-7a · architectural rule invariant: KERN-7 ratchet exists in eslint.config.mjs and is error, not warn', () => {
    const configPath = path.resolve(import.meta.dirname, '../eslint.config.mjs');
    const configSource = fs.readFileSync(configPath, 'utf-8');

    assert.ok(
        configSource.includes('ARCHITECTURAL RULE (KERN-7)'),
        'Rule definition missing: KERN-7 architectural rule must be declared in eslint.config.mjs'
    );
    assert.ok(
        configSource.includes('"error"') || configSource.includes("'error'"),
        'Severity check: rule must be configured'
    );

    // Verify it is error and not warn in the KERN-7 block
    const kern7BlockMatch = configSource.match(/\/\/ KERN-7:[\s\S]*?rules:\s*\{[\s\S]*?"no-restricted-syntax":\s*\[\s*"([^"]+)"/);
    assert.ok(kern7BlockMatch, 'KERN-7 block with no-restricted-syntax rule must exist');
    assert.equal(kern7BlockMatch[1], 'error', 'KERN-7 ratchet severity must be "error", not "warn"');
});

describe('R1-1c · provisionLockedDatabases mock behavior tests', () => {
    function createMockDb(initial: {
        tenant?: { id: string; lockedDbIds: Record<string, string> | null };
        databases?: Array<{ id: string; tenantId: string; logicalKey: string | null; name: string }>;
    }) {
        let tenantRow = initial.tenant ? { ...initial.tenant } : null;
        const dbRows = (initial.databases || []).map(d => ({ ...d }));
        let nextId = 100;
        const createdRows: any[] = [];
        const updatedRows: any[] = [];
        const tenantUpdates: any[] = [];

        return {
            tenant: {
                findUnique: async ({ where }: any) => {
                    if (tenantRow && tenantRow.id === where.id) {
                        return { lockedDbIds: tenantRow.lockedDbIds };
                    }
                    return null;
                },
                update: async ({ where, data }: any) => {
                    tenantUpdates.push({ where, data });
                    if (tenantRow && tenantRow.id === where.id) {
                        tenantRow.lockedDbIds = data.lockedDbIds;
                    }
                    return tenantRow;
                },
            },
            globalDatabase: {
                findMany: async ({ where }: any) => {
                    const idIn: string[] = where.id?.in || [];
                    return dbRows
                        .filter(r => r.tenantId === where.tenantId && idIn.includes(r.id))
                        .map(r => ({ id: r.id, logicalKey: r.logicalKey }));
                },
                findFirst: async ({ where }: any) => {
                    const found = dbRows.find(r => r.tenantId === where.tenantId && r.id === where.id);
                    return found ? { id: found.id, logicalKey: found.logicalKey } : null;
                },
                create: async ({ data }: any) => {
                    const id = `cuid-${nextId++}`;
                    const newRow = { id, ...data };
                    dbRows.push(newRow);
                    createdRows.push(newRow);
                    return { id };
                },
                update: async ({ where, data }: any) => {
                    updatedRows.push({ where, data });
                    const found = dbRows.find(r => r.id === where.id);
                    if (found) {
                        Object.assign(found, data);
                    }
                    return found;
                },
            },
            getCreatedRows: () => createdRows,
            getUpdatedRows: () => updatedRows,
            getTenantUpdates: () => tenantUpdates,
            getDbRows: () => dbRows,
        };
    }

    test('R1-1c · Fresh tenant: 16 databases created with both lockedDbIds and logicalKey', async () => {
        const { provisionLockedDatabases } = await import('../src/lib/provisionTenantDbs.ts');
        const mock = createMockDb({
            tenant: { id: 'tenant-fresh', lockedDbIds: null },
            databases: [],
        });

        const lockedDbIds = await provisionLockedDatabases('tenant-fresh', mock as any);

        assert.equal(mock.getCreatedRows().length, 16, 'Must create exactly 16 database rows');
        assert.equal(mock.getTenantUpdates().length, 1, 'Must update tenant lockedDbIds once');

        const dbRows = mock.getDbRows();
        for (const [role, dbId] of Object.entries(lockedDbIds)) {
            const row = dbRows.find(r => r.id === dbId);
            assert.ok(row, `Database row must exist for role ${role}`);
            assert.equal(row.logicalKey, role, `Database row must have logicalKey = "${role}"`);

            const resolvedRole = await roleOfDatabase('tenant-fresh', dbId, mock);
            assert.equal(resolvedRole, role, `roleOfDatabase must return "${role}" for database ${dbId}`);
        }
    });

    test('R1-1c · Complete healthy tenant: zero rows created, zero Tenant updates (NO-OP)', async () => {
        const { provisionLockedDatabases } = await import('../src/lib/provisionTenantDbs.ts');
        const { SYSTEM_DATABASE_ROLES } = await import('../src/lib/kernel/system-databases.ts');

        const lockedDbIds: Record<string, string> = {};
        const databases: any[] = [];
        for (const role of SYSTEM_DATABASE_ROLES) {
            const id = `db-${role}-id`;
            lockedDbIds[role] = id;
            databases.push({ id, tenantId: 'tenant-healthy', logicalKey: role, name: role });
        }

        const mock = createMockDb({
            tenant: { id: 'tenant-healthy', lockedDbIds },
            databases,
        });

        const result = await provisionLockedDatabases('tenant-healthy', mock as any);

        assert.equal(mock.getCreatedRows().length, 0, 'Healthy tenant must create 0 rows');
        assert.equal(mock.getUpdatedRows().length, 0, 'Healthy tenant must update 0 rows');
        assert.equal(mock.getTenantUpdates().length, 0, 'Healthy tenant must update 0 tenant rows');
        assert.deepEqual(result, lockedDbIds, 'Bindings must be returned identical');
    });

    test('R1-1c · Live dangling case (BV CORAL): hr repointed, reported naming db-hr, others preserved', async () => {
        const { provisionLockedDatabases } = await import('../src/lib/provisionTenantDbs.ts');
        const { SYSTEM_DATABASE_ROLES } = await import('../src/lib/kernel/system-databases.ts');

        const lockedDbIds: Record<string, string> = {};
        const databases: any[] = [];
        for (const role of SYSTEM_DATABASE_ROLES) {
            if (role === 'hr') {
                lockedDbIds['hr'] = 'db-hr'; // dangling: no row in databases!
            } else if (role === 'projects') {
                lockedDbIds['projects'] = 'db-1';
                databases.push({ id: 'db-1', tenantId: 'tenant-bv-coral', logicalKey: 'projects', name: 'Projects' });
            } else {
                const id = `db-${role}`;
                lockedDbIds[role] = id;
                databases.push({ id, tenantId: 'tenant-bv-coral', logicalKey: role, name: role });
            }
        }

        const mock = createMockDb({
            tenant: { id: 'tenant-bv-coral', lockedDbIds },
            databases,
        });

        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
            warnings.push(args.join(' '));
        };

        try {
            const result = await provisionLockedDatabases('tenant-bv-coral', mock as any);

            assert.equal(mock.getCreatedRows().length, 1, 'Must create exactly 1 replacement row for hr');
            const newHrRow = mock.getCreatedRows()[0];
            assert.equal(newHrRow.logicalKey, 'hr', 'Replacement row must have logicalKey = "hr"');
            assert.equal(result.hr, newHrRow.id, 'lockedDbIds.hr must be repointed to new row id');
            assert.notEqual(result.hr, 'db-hr', 'lockedDbIds.hr must no longer point to db-hr');

            // The other 15 bindings must remain byte-identical:
            assert.equal(result.projects, 'db-1', 'projects binding must remain db-1');
            for (const role of SYSTEM_DATABASE_ROLES) {
                if (role !== 'hr') {
                    assert.equal(result[role], lockedDbIds[role], `Binding for ${role} must be preserved byte-identical`);
                }
            }

            // Reported naming old id db-hr:
            assert.ok(
                warnings.some(w => w.includes('db-hr')),
                'Repair report must name old id "db-hr"'
            );
            assert.equal(mock.getTenantUpdates().length, 1, 'Must persist repointed lockedDbIds on tenant');
        } finally {
            console.warn = originalWarn;
        }
    });

    test('R1-1c · Existing resolving row lacking logicalKey gains it without recreation', async () => {
        const { provisionLockedDatabases } = await import('../src/lib/provisionTenantDbs.ts');
        const { SYSTEM_DATABASE_ROLES } = await import('../src/lib/kernel/system-databases.ts');

        const lockedDbIds: Record<string, string> = {};
        const databases: any[] = [];
        for (const role of SYSTEM_DATABASE_ROLES) {
            const id = `db-${role}`;
            lockedDbIds[role] = id;
            // 'crm' row resolves but has logicalKey: null
            databases.push({
                id,
                tenantId: 'tenant-backfill',
                logicalKey: role === 'crm' ? null : role,
                name: role,
            });
        }

        const mock = createMockDb({
            tenant: { id: 'tenant-backfill', lockedDbIds },
            databases,
        });

        const result = await provisionLockedDatabases('tenant-backfill', mock as any);

        assert.equal(mock.getCreatedRows().length, 0, 'Must create 0 rows');
        assert.equal(mock.getTenantUpdates().length, 0, 'Must not update tenant row');
        assert.equal(mock.getUpdatedRows().length, 1, 'Must update exactly 1 database row');
        assert.deepEqual(mock.getUpdatedRows()[0], {
            where: { id: 'db-crm' },
            data: { logicalKey: 'crm' },
        });
        assert.equal(result.crm, 'db-crm', 'Binding must remain unchanged');
    });
});

