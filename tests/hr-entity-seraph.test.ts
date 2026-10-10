/**
 * HR-ENTITY-SERAPH · api/hr/[entity] (crew clock-in, the scheduler, leave, teams) on the tenant-scoped client.
 * Florin 2026-10-10: "canonical scaffolding, NOTHING can deviate."
 *
 * 1. Census: the route has no raw prisma; each of its 4 handlers opens the scoped client; only Tenant goes through
 *    platformDb(); transactions run on the scoped client.
 * 2. The route's exact query shapes, through the seraph: a row of another tenant can't be read, changed or deleted
 *    "by id"; a via-model create without its parent is refused.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scopeArgs, TenantMismatchError } from '../src/lib/data/scope-args.ts';

const ROUTE = readFileSync('src/app/api/hr/[entity]/route.ts', 'utf8');
const T = 'tenant-session';
const FOREIGN = 'tenant-other';

describe('HR-ENTITY-SERAPH · census of the route', () => {
    test('no raw prisma: no import of lib/prisma, no `prisma.` call', () => {
        assert.doesNotMatch(ROUTE, /from '@\/lib\/prisma'/);
        assert.deepEqual(ROUTE.match(/\bprisma\s*\.|\(prisma as/g) ?? [], []);
    });
    test('each handler (GET, POST, PATCH, DELETE) opens the scoped client, and the entity model comes from it', () => {
        for (const verb of ['GET', 'POST', 'PATCH', 'DELETE']) {
            const start = ROUTE.indexOf(`export async function ${verb}(`);
            assert.ok(start >= 0, verb);
            const next = ROUTE.indexOf('export async function', start + 10);
            const body = ROUTE.slice(start, next < 0 ? undefined : next);
            assert.match(body, /const db = await scopeFromSession\(\);/, `${verb} opens the scoped client`);
            const firstModel = body.indexOf('getModel(');
            if (firstModel >= 0) assert.ok(body.indexOf('scopeFromSession()') < firstModel, `${verb}: scope before the model`);
        }
        assert.match(ROUTE, /function getModel\(db: TenantScopedClient, entity: string\)[\s\S]{0,200}return \(db as any\)\[modelName\]/);
    });
    test('platformDb() is used for Tenant only; transactions are on the scoped client', () => {
        const platform = ROUTE.match(/platformDb\(\)\.(\w+)/g) ?? [];
        assert.deepEqual([...new Set(platform)], ['platformDb().tenant']);
        assert.doesNotMatch(ROUTE, /\$transaction\(\[/);
        assert.equal((ROUTE.match(/db\.\$transaction\(async tx =>/g) ?? []).length, 4);
    });
});

describe('HR-ENTITY-SERAPH · the route\'s query shapes through the seraph', () => {
    test('GET by id (clock-entries ?id=) carries the session tenant; a forged tenant is overwritten by it', () => {
        const { args } = scopeArgs('ClockEntry', 'findMany', { where: { id: 'e1' }, orderBy: { createdAt: 'desc' } }, T);
        assert.deepEqual(args.where, { id: 'e1', tenantId: T });
        const forged = scopeArgs('ClockEntry', 'findMany', { where: { id: 'e1', tenantId: FOREIGN } }, T);
        assert.equal((forged.args.where as { tenantId?: string }).tenantId, T);
    });
    test('PATCH clock-entries update by id is limited to the session tenant', () => {
        const { args } = scopeArgs('ClockEntry', 'update', { where: { id: 'e1' }, data: { clockOutTime: new Date() } }, T);
        assert.equal(JSON.stringify(args.where).includes(T), true);
    });
    test('PATCH cannot move a row to another tenant', () => {
        assert.throws(() => scopeArgs('ScheduledShift', 'update', { where: { id: 's1' }, data: { tenantId: FOREIGN } }, T), TenantMismatchError);
    });
    test('DELETE a shift by id and a series deleteMany are limited to the session tenant', () => {
        const one = scopeArgs('ScheduledShift', 'delete', { where: { id: 's1' } }, T);
        assert.equal(JSON.stringify(one.args.where).includes(T), true);
        const many = scopeArgs('ScheduledShift', 'deleteMany', { where: { seriesId: 'x', clockEntries: { none: {} } } }, T);
        assert.equal(JSON.stringify(many.args.where).includes(T), true);
    });
    test('POST clock-in: the tenant is injected; a body naming another tenant is refused', () => {
        const { args } = scopeArgs('ClockEntry', 'create', { data: { userId: 'u1', clockInTime: new Date() } }, T);
        assert.equal((args.data as { tenantId?: string }).tenantId, T);
        assert.throws(() => scopeArgs('ClockEntry', 'create', { data: { userId: 'u1', tenantId: FOREIGN } }, T), TenantMismatchError);
    });
    test('POST shift-tasks / shift-attachments / team-members without their parent are refused; with it the parent is verified', () => {
        for (const [model, parentKey, parent] of [['ShiftTask', 'shiftId', 'ScheduledShift'], ['ShiftAttachment', 'shiftId', 'ScheduledShift'], ['HrTeamMember', 'teamId', 'HrTeam']] as const) {
            assert.throws(() => scopeArgs(model, 'create', { data: { title: 'x' } }, T), TenantMismatchError, `${model} without ${parentKey}`);
            const { verifyParents } = scopeArgs(model, 'create', { data: { [parentKey]: 'p1' } }, T);
            assert.deepEqual(verifyParents.map(v => [v.parent, v.id]), [[parent, 'p1']]);
        }
    });
    test('PATCH team-members findUnique by id is scoped through the team', () => {
        const { args } = scopeArgs('HrTeamMember', 'findUnique', { where: { id: 'm1' }, include: { team: { select: { tenantId: true } } } }, T);
        assert.equal(JSON.stringify(args.where).includes(T), true);
    });
});
