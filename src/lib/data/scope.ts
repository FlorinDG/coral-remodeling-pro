/**
 * R1-4 · THE ONLY DOOR — the TenantScopedClient (design: .agents/workflows/coral-tsc-design.md, TSC-0).
 *
 *   const db = await scopeFromSession();   // D3: the tenant is never a parameter
 *   await db.invoice.findMany({ … });      // scoped by construction — reads AND writes (D7)
 *
 * - D1  Prisma `$extends` injects the scope on every operation of every model.
 * - D2  SCOPE (scope-rules.ts) is the one table; a model absent from it THROWS (fails closed).
 * - D4  platformDb() is a second, named door for Tenant / VerificationToken / cross-tenant work.
 * - D5  systemScope(tenantId, reason) — same client type; a system write with no reason is refused.
 * - D6  $queryRaw / $executeRaw are not on the scoped client's type.
 * - D7  update/delete carry the read scope, so a row of another tenant cannot be touched "by id";
 *       create injects tenantId (direct) or verifies the parent belongs to the tenant (via).
 *
 * Adoption is R1-5: callers move to this client file by file, and direct prisma outside lib/data
 * becomes a CI failure. Nothing imports this yet — building the door does not open it.
 */
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { scopeWhere } from './scope-rules';
import { scopeArgs, TenantMismatchError, type Args } from './scope-args';

export { TenantMismatchError };

function lowerFirst(s: string) { return s.charAt(0).toLowerCase() + s.slice(1); }

function buildScopedClient(tenantId: string) {
    if (!tenantId) throw new Error('scoped client: no tenant');
    const extended = prisma.$extends({
        name: `tenant-scope`,
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const { args: scoped, verifyParents } = scopeArgs(model, operation, args as Args, tenantId);
                    for (const { parent, id } of verifyParents) {
                        const delegate = (prisma as unknown as Record<string, { findFirst: (a: Args) => Promise<unknown> }>)[lowerFirst(parent)];
                        const found = await delegate.findFirst({ where: scopeWhere(parent, tenantId, { id }) as Args, select: { id: true } });
                        if (!found) throw new TenantMismatchError(model, `parent ${parent} ${id} is not in this tenant`);
                    }
                    return query(scoped as typeof args);
                },
            },
        },
    });
    return extended as Omit<typeof extended, '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$transaction'> & {
        $transaction: typeof extended['$transaction'];
    };
}

export type TenantScopedClient = ReturnType<typeof buildScopedClient>;

/** D3 — the tenant comes from the session, once, at the boundary. Throws without a tenant. */
export async function scopeFromSession(): Promise<TenantScopedClient> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    if (!tenantId) throw new Error('scopeFromSession: no tenant in session');
    return buildScopedClient(tenantId);
}

/** D5 — cron, webhooks, per-tenant jobs. Same client type; a system write with no reason is refused. */
export function systemScope(tenantId: string, reason: string): TenantScopedClient {
    if (!reason || !reason.trim()) throw new Error('systemScope: a reason is required');
    console.info(`[systemScope] tenant=${tenantId} reason=${reason}`);
    return buildScopedClient(tenantId);
}

/** D4 — the second, named door: Tenant, VerificationToken, and cross-tenant superadmin work. */
export function platformDb() {
    return prisma;
}
