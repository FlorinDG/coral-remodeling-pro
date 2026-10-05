/**
 * R2-1 · ONE server write for a record (GlobalPage) — the core door. Rule: lib/records/record-intent.ts.
 *
 * On the caller's scoped client (a record is reachable only through its database's tenant), inside ONE
 * serializable transaction (retried on a concurrent write): read the CURRENT row, apply the intent, write only when
 * something changed, and return the PERSISTED state — `updatedAt` and `blocksVersion` from the saved row, never a
 * self-made timestamp (R2-3 / OCC-14). Before this, the doors read, merged and wrote in three separate steps: two
 * saves of one row at the same moment could both read the old row and the second overwrote the first.
 *
 * Adapters (keep their names during the migration, then go): saveGlobalPage → saveRecord.
 */
import type { Prisma } from '@prisma/client';
import type { TenantScopedClient } from '@/lib/data/scope';
import { applyRecordIntent, type RecordIntent, type RecordRefusal } from '@/lib/records/record-intent';

export interface RecordMeta { coverImage?: string | null; icon?: string | null; order?: number | null; driveFolderId?: string | null }

/** When the record does not exist yet (a page minted by the browser), it is created in this database. */
export interface CreateIfMissing { databaseId: string; properties: Record<string, unknown>; blocks?: unknown[]; createdBy: string }

export type SaveRecordResult =
    | { ok: true; created: boolean; changed: boolean; updatedAt: string; blocksVersion: number; properties: Record<string, unknown>; keptServer: Record<string, unknown>; ignored: string[] }
    | { ok: false; refusal: RecordRefusal | { code: 'NOT_FOUND' }; server?: { properties: Record<string, unknown>; blocks: unknown; updatedAt: string; blocksVersion: number; lastEditedBy: string } ; logicalKey?: string | null; dbProperties?: Array<{ id: string; name?: string; type?: string }> };

export async function saveRecord(
    db: TenantScopedClient,
    intent: RecordIntent,
    opts: { by: string; meta?: RecordMeta; createIfMissing?: CreateIfMissing },
): Promise<SaveRecordResult> {
    const run = () => db.$transaction(async tx => {
        const row = await tx.globalPage.findFirst({
            where: { id: intent.pageId },
            select: { properties: true, blocks: true, blocksVersion: true, updatedAt: true, lastEditedBy: true, coverImage: true, icon: true, order: true, driveFolderId: true, database: { select: { logicalKey: true, properties: true } } },
        });

        if (!row) {
            const c = opts.createIfMissing;
            if (!c) return { ok: false as const, refusal: { code: 'NOT_FOUND' as const } };
            // The database must be this tenant's (the scoped client finds only the tenant's databases).
            const parent = await tx.globalDatabase.findFirst({ where: { id: c.databaseId }, select: { id: true } });
            if (!parent) return { ok: false as const, refusal: { code: 'NOT_FOUND' as const } };
            const saved = await tx.globalPage.create({
                data: {
                    id: intent.pageId, databaseId: c.databaseId,
                    properties: c.properties as Prisma.InputJsonValue,
                    blocks: (c.blocks ?? []) as Prisma.InputJsonValue,
                    blocksVersion: 1,
                    createdBy: c.createdBy, lastEditedBy: opts.by,
                    coverImage: opts.meta?.coverImage ?? null, icon: opts.meta?.icon ?? null,
                    order: opts.meta?.order ?? null, driveFolderId: opts.meta?.driveFolderId ?? null,
                },
                select: { updatedAt: true, blocksVersion: true, properties: true },
            });
            return { ok: true as const, created: true, changed: true, updatedAt: saved.updatedAt.toISOString(), blocksVersion: saved.blocksVersion, properties: saved.properties as Record<string, unknown>, keptServer: {}, ignored: [] };
        }

        const dbProperties = Array.isArray(row.database?.properties) ? row.database.properties as Array<{ id: string; name?: string; type?: string }> : [];
        const server = {
            properties: (row.properties || {}) as Record<string, unknown>,
            blocks: row.blocks, blocksVersion: row.blocksVersion, updatedAt: row.updatedAt.toISOString(),
        };
        const r = applyRecordIntent(server, intent, { dbProperties, logicalKey: row.database?.logicalKey });
        if (!r.ok) {
            return { ok: false as const, refusal: r.refusal, server: { ...server, lastEditedBy: row.lastEditedBy }, logicalKey: row.database?.logicalKey, dbProperties };
        }
        // Meta written only when it DIFFERS — an unchanged save must not bump updatedAt (every other editor would
        // then see a newer version and merge for nothing).
        const meta: RecordMeta = {};
        for (const k of ['coverImage', 'icon', 'order', 'driveFolderId'] as const) {
            const v = opts.meta?.[k];
            if (v !== undefined && v !== (row as Record<string, unknown>)[k]) (meta as Record<string, unknown>)[k] = v;
        }
        const metaChanged = Object.keys(meta).length > 0;
        if (!r.changed && !metaChanged) {
            return { ok: true as const, created: false, changed: false, updatedAt: server.updatedAt, blocksVersion: server.blocksVersion, properties: server.properties, keptServer: {}, ignored: r.ignored };
        }
        const data: Prisma.GlobalPageUpdateInput = { properties: r.properties as Prisma.InputJsonValue, lastEditedBy: opts.by };
        if (r.blocks !== undefined) { data.blocks = r.blocks as Prisma.InputJsonValue; data.blocksVersion = r.blocksVersion; }
        Object.assign(data, meta);
        const saved = await tx.globalPage.update({ where: { id: intent.pageId }, data, select: { updatedAt: true, blocksVersion: true } });
        const keptServer = Object.fromEntries(r.keptServer.map(k => [k, r.properties[k]]));
        return { ok: true as const, created: false, changed: true, updatedAt: saved.updatedAt.toISOString(), blocksVersion: saved.blocksVersion, properties: r.properties, keptServer, ignored: r.ignored };
    }, { isolationLevel: 'Serializable' });

    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (err) {
            if ((err as { code?: string })?.code === 'P2034' && attempt < 4) continue;   // a concurrent write of this row
            throw err;
        }
    }
}
