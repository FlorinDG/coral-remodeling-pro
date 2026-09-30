/**
 * R1-4 · the PURE half of the TenantScopedClient: how one Prisma operation's arguments are rewritten
 * so they cannot reach another tenant. No I/O — parent checks are RETURNED for the caller to run.
 * Tested in tests/scope-args.test.ts. The client itself lives in ./scope.ts.
 */
import { Prisma } from '@prisma/client';
import { SCOPE, scopeWhere, UnclassifiedModelError, PlatformModelError } from './scope-rules';

export class TenantMismatchError extends Error {
    constructor(model: string, detail: string) {
        super(`tenant_mismatch on ${model}: ${detail}`);
        this.name = 'TenantMismatchError';
    }
}

export type Args = Record<string, unknown>;
const isObj = (v: unknown): v is Args => !!v && typeof v === 'object' && !Array.isArray(v);

const READ_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const WHERE_WRITE_OPS = new Set(['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

/** For a via model: the parent relation's foreign key and the parent model, read from the DMMF. */
export function viaParent(model: string): { fk: string; parent: string; through: string } {
    const rule = SCOPE[model];
    if (!rule || rule.kind !== 'via') throw new Error(`viaParent(${model}): not a via model`);
    const m = Prisma.dmmf.datamodel.models.find(x => x.name === model);
    const f = m?.fields.find(x => x.name === rule.through);
    const fk = f?.relationFromFields?.[0];
    if (!f || !fk) throw new Error(`viaParent(${model}): relation "${rule.through}" has no foreign key`);
    return { fk, parent: f.type, through: rule.through };
}

/** The parent id a create/update names for a via model, or null if it names none. */
export function parentIdOf(model: string, data: Args): string | null {
    const { fk, through } = viaParent(model);
    if (typeof data[fk] === 'string') return data[fk] as string;
    const rel = data[through];
    if (isObj(rel)) {
        if (isObj(rel.connect) && typeof rel.connect.id === 'string') return rel.connect.id;
        if ('create' in rel || 'connectOrCreate' in rel) {
            throw new TenantMismatchError(model, `nested create of the parent "${through}" is not allowed through the scoped client`);
        }
    }
    return null;
}

/** Direct model: tenantId is injected when absent; a different tenant is refused. */
export function scopeCreateData(model: string, data: Args, tenantId: string): Args {
    const rule = SCOPE[model];
    if (!rule) throw new UnclassifiedModelError(model);
    if (rule.kind === 'platform') throw new PlatformModelError(model);
    if (rule.kind !== 'direct') return data;
    if (data.tenantId !== undefined && data.tenantId !== tenantId) {
        throw new TenantMismatchError(model, 'create names another tenant');
    }
    const t = data.tenant;
    if (isObj(t) && isObj(t.connect) && t.connect.id !== tenantId) {
        throw new TenantMismatchError(model, 'create connects another tenant');
    }
    return isObj(t) ? data : { ...data, tenantId };
}

/**
 * PURE — the argument rewrite for one operation. Parent verification (via creates, and updates that
 * move a via row to another parent) is returned as a list of { parent, id } checks for the caller to run.
 */
export function scopeArgs(model: string, operation: string, args: Args | undefined, tenantId: string):
    { args: Args; verifyParents: Array<{ parent: string; id: string }> } {
    const a: Args = { ...(args || {}) };
    const verify: Array<{ parent: string; id: string }> = [];
    const kind = SCOPE[model]?.kind;

    if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
        a.where = scopeWhere(model, tenantId, a.where as object | undefined);
    } else if (!CREATE_OPS.has(operation) && operation !== 'upsert') {
        throw new Error(`scoped client: operation "${operation}" on ${model} is not supported`);
    } else {
        scopeWhere(model, tenantId); // classification check — throws for platform / unknown
    }

    const guardUpdate = (data: unknown) => {
        if (!isObj(data)) return;
        if (kind === 'direct' && data.tenantId !== undefined && data.tenantId !== tenantId) {
            throw new TenantMismatchError(model, 'update moves the row to another tenant');
        }
        if (kind === 'via') {
            const pid = parentIdOf(model, data);
            if (pid) verify.push({ parent: viaParent(model).parent, id: pid });
        }
    };
    const prepareCreate = (data: unknown): Args => {
        if (!isObj(data)) throw new TenantMismatchError(model, 'create without data');
        if (kind === 'via') {
            const pid = parentIdOf(model, data);
            if (!pid) throw new TenantMismatchError(model, `create must name its parent "${viaParent(model).through}"`);
            verify.push({ parent: viaParent(model).parent, id: pid });
            return data;
        }
        return scopeCreateData(model, data, tenantId);
    };

    if (operation === 'create') a.data = prepareCreate(a.data);
    if (operation === 'createMany' || operation === 'createManyAndReturn') {
        const rows = Array.isArray(a.data) ? a.data : [a.data];
        a.data = rows.map(prepareCreate);
    }
    if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') guardUpdate(a.data);
    if (operation === 'upsert') {
        a.where = scopeWhere(model, tenantId, a.where as object | undefined);
        a.create = prepareCreate(a.create);
        guardUpdate(a.update);
    }
    // de-duplicate parent checks
    const seen = new Set<string>();
    return { args: a, verifyParents: verify.filter(v => (seen.has(`${v.parent}:${v.id}`) ? false : (seen.add(`${v.parent}:${v.id}`), true))) };
}

