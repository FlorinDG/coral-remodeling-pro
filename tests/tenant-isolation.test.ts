/**
 * CORAL — TENANT ISOLATION CONTRACT TEST (TSC-9)
 *
 * WHAT THIS TEST DOES NOT DO:
 * It does not prove no query leaks. It proves the rule is right and total.
 * Three things stay outside it, and each has its own mechanism:
 *
 * | Risk | Covered by |
 * |---|---|
 * | Code bypasses the client entirely | R1-5 ESLint ratchet — 121 allowlisted, falling |
 * | $queryRaw evades $extends | TSC-7 — three named functions in lib/data/raw/, $queryRaw removed from the client type |
 * | An automation reaches another model unscoped | HRA was exactly this. R1-4 is the structural answer |
 *
 * A green tenant-isolation.test.ts must never be quoted as "tenancy is proven."
 * It is one of four mechanisms, and TSC-0 D1 already said no single mechanism is sufficient.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    SCOPE,
    scopeWhere,
    UnclassifiedModelError,
    PlatformModelError,
} from '../src/lib/data/scope-rules.ts';
import type { ScopeRule } from '../src/lib/data/scope-rules.ts';

function parseSchemaModels(): Map<string, string> {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const lines = content.split('\n');
    let currentModel: string | null = null;
    let currentBody: string[] = [];
    const models = new Map<string, string>();
    for (const line of lines) {
        const m = line.match(/^model\s+(\w+)\s*\{/);
        if (m) {
            currentModel = m[1];
            currentBody = [];
        } else if (currentModel) {
            if (line.trim() === '}') {
                models.set(currentModel, currentBody.join('\n'));
                currentModel = null;
            } else {
                currentBody.push(line);
            }
        }
    }
    return models;
}

function parseModelRelations(modelBody: string): string[] {
    const lines = modelBody.split('\n');
    const relations: string[] = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.includes('@relation')) {
            const fieldMatch = line.match(/^(\w+)\s+/);
            if (fieldMatch) {
                relations.push(fieldMatch[1]);
            }
        }
    }
    return relations;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2A · EXHAUSTIVENESS — the test that keeps working after we stop looking
// ─────────────────────────────────────────────────────────────────────────────

describe('A · Schema Exhaustiveness & Census (TSC-9 §2A)', () => {
    const schemaModels = parseSchemaModels();

    test('census count: exactly 55 models in schema', () => {
        assert.equal(
            schemaModels.size,
            55,
            `Expected 55 models in schema.prisma, found ${schemaModels.size}`
        );
    });

    test('every model in schema.prisma is classified in SCOPE table', () => {
        for (const model of schemaModels.keys()) {
            assert.ok(
                model in SCOPE,
                `Model "${model}" from schema.prisma is missing from SCOPE classification table.`
            );
        }
    });

    test('no ghost models in SCOPE that do not exist in schema.prisma', () => {
        for (const model of Object.keys(SCOPE)) {
            assert.ok(
                schemaModels.has(model),
                `SCOPE table contains model "${model}" which does not exist in schema.prisma.`
            );
        }
    });

    test('classification breakdown matches exact census: 33 direct / 20 via / 2 platform', () => {
        const rules = Object.values(SCOPE);
        const direct = rules.filter((r): r is { kind: 'direct' } => r.kind === 'direct');
        const via = rules.filter((r): r is { kind: 'via'; through: string } => r.kind === 'via');
        const platform = rules.filter((r): r is { kind: 'platform' } => r.kind === 'platform');

        assert.equal(direct.length, 33, `Expected 33 direct models, got ${direct.length}`);
        assert.equal(via.length, 20, `Expected 20 via models, got ${via.length}`);
        assert.equal(platform.length, 2, `Expected 2 platform models, got ${platform.length}`);
    });

    test('every via rule through names a real relation field on that model in schema.prisma', () => {
        for (const [model, rule] of Object.entries(SCOPE)) {
            if (rule.kind === 'via') {
                const body = schemaModels.get(model);
                assert.ok(body, `Model ${model} must exist in schema`);
                const relations = parseModelRelations(body);
                assert.ok(
                    relations.includes(rule.through),
                    `Model "${model}" via rule specifies through: "${rule.through}", but schema fields with @relation are: [${relations.join(', ')}]`
                );
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2B · THE WHERE-BUILDER CONTRACT (TSC-9 §2B)
// ─────────────────────────────────────────────────────────────────────────────

describe('B · Where-Builder Contract (TSC-9 §2B)', () => {
    test('Class A: merges { tenantId } into where clause', () => {
        const where = scopeWhere('Invoice', 'tenant-alpha');
        assert.deepEqual(where, { tenantId: 'tenant-alpha' });
    });

    test('Class B: scopes transitively via parent relation field', () => {
        // Specifically pin GlobalPage → { database: { tenantId } }
        // GlobalPage has no tenantId of its own and never will
        const where = scopeWhere('GlobalPage', 'tenant-alpha');
        assert.deepEqual(where, { database: { tenantId: 'tenant-alpha' } });
    });

    test('Class D: throws PlatformModelError (platform access is a second named client)', () => {
        assert.throws(
            () => scopeWhere('Tenant', 'tenant-alpha'),
            PlatformModelError,
            'scopeWhere on Tenant must throw PlatformModelError'
        );
        assert.throws(
            () => scopeWhere('VerificationToken', 'tenant-alpha'),
            PlatformModelError,
            'scopeWhere on VerificationToken must throw PlatformModelError'
        );
    });

    test('Unknown model: throws UnclassifiedModelError (fails closed)', () => {
        assert.throws(
            () => scopeWhere('NonExistentModel', 'tenant-alpha'),
            UnclassifiedModelError,
            'scopeWhere on unknown model must throw UnclassifiedModelError'
        );
    });

    test('Anti-hijacking: user where cannot override tenantId in Class A', () => {
        // scopeWhere('Invoice', 'tenant-A', { tenantId: 'tenant-B' }) must still constrain to tenant-A
        const where = scopeWhere('Invoice', 'tenant-A', { tenantId: 'tenant-B' }) as any;
        assert.notEqual(where.tenantId, 'tenant-B', 'User where must never overwrite tenantId');
        assert.equal(where.tenantId, 'tenant-A');
    });

    test('Anti-hijacking: user where with nested OR cannot evade tenant constraint', () => {
        const userWhere = { OR: [{ status: 'draft' }, { tenantId: 'tenant-B' }] };
        const where = scopeWhere('Invoice', 'tenant-A', userWhere) as any;
        // Tenant must be ANDed so the scope cannot be widened
        assert.ok(where.AND || where.tenantId === 'tenant-A');
    });

    test('Anti-hijacking: user where cannot override parent tenant in Class B', () => {
        const userWhere = { database: { tenantId: 'tenant-B' } };
        const where = scopeWhere('GlobalPage', 'tenant-A', userWhere) as any;
        assert.notEqual(where.database?.tenantId, 'tenant-B');
        assert.equal(where.database?.tenantId, 'tenant-A');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2C · REGRESSION PINS — this week\'s seven holes, named (TSC-9 §2C)
// ─────────────────────────────────────────────────────────────────────────────

describe('C · Regression Pins — this week\'s holes, named (TSC-9 §2C)', () => {
    // TSC-4a (read) & TSC-4b (write): missing relation allowed cross-tenant access to shift tasks
    test('ShiftTask → { shift: { tenantId } } (TSC-4a, TSC-4b read/write holes)', () => {
        const where = scopeWhere('ShiftTask', 'tenant-alpha');
        assert.deepEqual(where, { shift: { tenantId: 'tenant-alpha' } });
    });

    // TSC-4a (read) & TSC-4b (write): missing relation allowed cross-tenant access to shift attachments
    test('ShiftAttachment → { shift: { tenantId } } (TSC-4a, TSC-4b read/write holes)', () => {
        const where = scopeWhere('ShiftAttachment', 'tenant-alpha');
        assert.deepEqual(where, { shift: { tenantId: 'tenant-alpha' } });
    });

    // HrTeamMember relation-scoped via team parent; pinned so it stays
    test('HrTeamMember → { team: { tenantId } } (the one that was always right — pin it)', () => {
        const where = scopeWhere('HrTeamMember', 'tenant-alpha');
        assert.deepEqual(where, { team: { tenantId: 'tenant-alpha' } });
    });

    // HRA-2 & HRA-3: clock-in/out automations reached ScheduledShift with unverified shiftId
    test('ScheduledShift → { tenantId } direct (HRA-2, HRA-3 unguarded shift automations)', () => {
        const where = scopeWhere('ScheduledShift', 'tenant-alpha');
        assert.deepEqual(where, { tenantId: 'tenant-alpha' });
    });

    // HRA-1: clock-entry creation reached parent ScheduledShift unscoped to inherit projectId
    test('ClockEntry → { tenantId } direct (HRA-1 project inheritance read hole)', () => {
        const where = scopeWhere('ClockEntry', 'tenant-alpha');
        assert.deepEqual(where, { tenantId: 'tenant-alpha' });
    });

    // R1 core case: GlobalPage has no tenantId of its own and must be transitively scoped via database
    test('GlobalPage → { database: { tenantId } } (R1 core case)', () => {
        const where = scopeWhere('GlobalPage', 'tenant-alpha');
        assert.deepEqual(where, { database: { tenantId: 'tenant-alpha' } });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2D · CONSTRUCTION CONTRACT — no path yields an unscoped client (TSC-9 §2D)
// ─────────────────────────────────────────────────────────────────────────────

describe('D · Construction Contract — no path yields an unscoped client (R1-4)', { skip: 'R1-4: scope.ts not implemented yet' }, () => {
    test('systemScope(tenantId, reason) requires non-empty reason (TSC-0 D5)', async () => {
        // @ts-expect-error scope.ts not yet implemented
        const { systemScope } = await import('../src/lib/data/scope.ts');
        assert.throws(() => systemScope('tenant-alpha', ''), /reason required/i);
        assert.throws(() => (systemScope as any)('tenant-alpha'), /reason required/i);
    });

    test('scopeFromSession() without tenant throws and never returns null or unscoped client (TSC-0 D3, R1-2)', async () => {
        // @ts-expect-error scope.ts not yet implemented
        const { scopeFromSession } = await import('../src/lib/data/scope.ts');
        await assert.rejects(async () => {
            await scopeFromSession();
        }, /no tenant/i);
    });
});
