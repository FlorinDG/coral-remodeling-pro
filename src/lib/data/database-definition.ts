/**
 * DB-DEF-1 · the ONE server door for a database's definition (fields, views, name). Operations, not snapshots:
 * the rule is lib/records/database-definition.ts; this applies it to the server's CURRENT row on the caller's
 * scoped client, in one serializable transaction (retried on a concurrent write), and writes only the columns that
 * changed. Returns the server's definition — the store takes it (one authority on "current", R2-3).
 */
import type { Prisma } from '@prisma/client';
import type { TenantScopedClient } from '@/lib/data/scope';
import { applyDefinitionOps, type DefOp, type Definition, type DefRefusal } from '@/lib/records/database-definition';
import { SYSTEM_DATABASES, type SystemDatabaseRole } from '@/lib/kernel/system-databases';
import { canonicalFieldIds } from '@/lib/kernel/system-schemas';

export type DefinitionResult =
    | { ok: true; definition: Definition; updatedAt: string; refused: Array<{ op: string; id?: string; reason: DefRefusal }> }
    | { ok: false; error: 'not_found' | 'invalid_ops' | 'failed'; detail?: string };

/** The canonical field ids of a system database's role (never deleted / retyped by a tenant). */
function canonicalIdsOf(role: string | null | undefined): Set<string> {
    const spec = role ? SYSTEM_DATABASES[role as SystemDatabaseRole] : undefined;
    return canonicalFieldIds(spec?.legacyBase);
}

export async function applyDatabaseDefinition(db: TenantScopedClient, databaseId: string, ops: DefOp[], opts: { allowSystemEdit: boolean }): Promise<DefinitionResult> {
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) return { ok: false, error: 'invalid_ops' };
    const run = () => db.$transaction(async tx => {
        const row = await tx.globalDatabase.findFirst({
            where: { id: databaseId },
            select: { id: true, logicalKey: true, name: true, description: true, icon: true, coverImage: true, properties: true, views: true, updatedAt: true },
        });
        if (!row) return null;
        const current: Definition = {
            name: row.name, description: row.description, icon: row.icon, coverImage: row.coverImage,
            properties: Array.isArray(row.properties) ? row.properties as unknown as Definition['properties'] : [],
            views: Array.isArray(row.views) ? row.views as unknown as Definition['views'] : [],
        };
        const r = applyDefinitionOps(current, ops, { canonicalIds: canonicalIdsOf(row.logicalKey), allowSystemEdit: opts.allowSystemEdit });
        if (!r.changed.properties && !r.changed.views && !r.changed.meta) {
            return { definition: current, updatedAt: row.updatedAt, refused: r.refused };   // no write, no updatedAt bump
        }
        const data: Prisma.GlobalDatabaseUpdateInput = {};
        if (r.changed.properties) data.properties = r.next.properties as unknown as Prisma.InputJsonValue;
        if (r.changed.views) data.views = r.next.views as unknown as Prisma.InputJsonValue;
        if (r.changed.meta) {
            if (r.next.name !== undefined) data.name = r.next.name;
            if (r.next.description !== undefined) data.description = r.next.description;
            if (r.next.icon !== undefined) data.icon = r.next.icon;
            if (r.next.coverImage !== undefined) data.coverImage = r.next.coverImage;
        }
        const saved = await tx.globalDatabase.update({ where: { id: row.id }, data, select: { updatedAt: true } });
        return { definition: r.next, updatedAt: saved.updatedAt, refused: r.refused };
    }, { isolationLevel: 'Serializable' });

    for (let attempt = 1; ; attempt++) {
        try {
            const out = await run();
            if (!out) return { ok: false, error: 'not_found' };
            return { ok: true, definition: out.definition, updatedAt: out.updatedAt.toISOString(), refused: out.refused };
        } catch (err) {
            if ((err as { code?: string })?.code === 'P2034' && attempt < 4) continue;   // a concurrent definition write
            return { ok: false, error: 'failed', detail: err instanceof Error ? err.message : String(err) };
        }
    }
}
