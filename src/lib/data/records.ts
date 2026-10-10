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
import type { TenantScopedClient, ScopedTx } from '@/lib/data/scope';
import { applyRecordIntent, deleteRefusal, type RecordIntent, type RecordRefusal } from '@/lib/records/record-intent';
import { nextInSeries } from '@/lib/records/series';
import { sanitizeBlocks } from '@/lib/records/rich-text';
import type { CreateIfMissing, RecordMeta } from '@/lib/records/record-intent';
export type { CreateIfMissing, RecordMeta };

export type SaveRecordResult =
    | { ok: true; created: boolean; changed: boolean; updatedAt: string; blocksVersion: number; properties: Record<string, unknown>; keptServer: Record<string, unknown>; ignored: string[] }
    | { ok: false; refusal: RecordRefusal | { code: 'NOT_FOUND' }; server?: { properties: Record<string, unknown>; blocks: unknown; updatedAt: string; blocksVersion: number; lastEditedBy: string } ; logicalKey?: string | null; dbProperties?: Array<{ id: string; name?: string; type?: string }> };

export type SaveRecordOpts = { by: string; meta?: RecordMeta; createIfMissing?: CreateIfMissing; lifecycle?: { reason: string } };

/** The transaction client of the scoped door (what `$transaction(async tx => …)` hands over). */

/** A concurrent write of a row (serializable conflict) is retried — the transaction re-reads and re-applies. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (err) {
            if ((err as { code?: string })?.code === 'P2034' && attempt < 4) continue;   // a concurrent write of this row
            throw err;
        }
    }
}

export async function saveRecord(db: TenantScopedClient, intent: RecordIntent, opts: SaveRecordOpts): Promise<SaveRecordResult> {
    return withRetry(() => db.$transaction(tx => saveInTx(tx, intent, opts), { isolationLevel: 'Serializable' }));
}

/** Thrown inside a batch to roll it back; carries the refusal out. */
class BatchRefused extends Error {
    readonly index: number;
    readonly result: Extract<SaveRecordResult, { ok: false }>;
    constructor(index: number, result: Extract<SaveRecordResult, { ok: false }>) {
        super('batch refused');
        this.index = index;
        this.result = result;
    }
}

/**
 * Several records in ONE serializable transaction — all saved, or none (e.g. the accountant export's stamp on every
 * exported document, R2-1-B: a loop of saveRecord left some stamped when one failed). Each item goes through the same
 * rule as saveRecord. `within(tx)` runs in the same transaction after the saves (the audit entries of the same act).
 */
export async function saveRecords(
    db: TenantScopedClient,
    items: Array<{ intent: RecordIntent; opts: SaveRecordOpts }>,
    options: { within?: (tx: ScopedTx) => Promise<void>; timeout?: number } = {},
): Promise<{ ok: true; results: Array<Extract<SaveRecordResult, { ok: true }>> } | { ok: false; index: number; pageId: string; refusal: Extract<SaveRecordResult, { ok: false }>['refusal'] }> {
    try {
        const results = await withRetry(() => db.$transaction(async tx => {
            const out: Array<Extract<SaveRecordResult, { ok: true }>> = [];
            for (let i = 0; i < items.length; i++) {
                const r = await saveInTx(tx, items[i].intent, items[i].opts);
                if (!r.ok) throw new BatchRefused(i, r);
                out.push(r);
            }
            if (options.within) await options.within(tx);
            return out;
        }, { isolationLevel: 'Serializable', timeout: options.timeout ?? 60_000 }));
        return { ok: true, results };
    } catch (err) {
        if (err instanceof BatchRefused) return { ok: false, index: err.index, pageId: items[err.index].intent.pageId, refusal: err.result.refusal };
        throw err;
    }
}

/** The door's rule for ONE record, inside the caller's transaction. */
async function saveInTx(tx: ScopedTx, intent: RecordIntent, opts: SaveRecordOpts): Promise<SaveRecordResult> {
    {
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
            // A series number is read and assigned in THIS serializable transaction: a concurrent creation in the same
            // series conflicts, is retried (P2034 below) and reads the number this one took.
            let properties = c.properties;
            if (c.series) {
                const taken = await tx.globalPage.findMany({
                    where: { databaseId: c.databaseId, properties: { path: ['title'], string_starts_with: c.series.prefix } },
                    select: { properties: true },
                });
                properties = { ...properties, title: nextInSeries(taken.map(p => String(((p.properties || {}) as Record<string, unknown>).title ?? '')), c.series) };
            }
            const saved = await tx.globalPage.create({
                data: {
                    id: intent.pageId, databaseId: c.databaseId,
                    properties: properties as Prisma.InputJsonValue,
                    blocks: sanitizeBlocks(c.blocks ?? []) as Prisma.InputJsonValue,   // EDITOR-1 E2
                    blocksVersion: 1,
                    createdBy: c.createdBy, lastEditedBy: opts.by, assignedTo: c.assignedTo ?? [],
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
        const r = applyRecordIntent(server, intent, { dbProperties, logicalKey: row.database?.logicalKey, lifecycle: opts.lifecycle });
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
    }
}

/** R2-1 · delete a record of THIS tenant — refused for an issued document (record-intent deleteRefusal). */
export async function deleteRecord(db: TenantScopedClient, pageId: string): Promise<{ ok: true } | { ok: false; refusal: 'NOT_FOUND' | 'EXPORT_LOCKED' | 'DOCUMENT_LOCKED' }> {
    const row = await db.globalPage.findFirst({ where: { id: pageId }, select: { properties: true, database: { select: { logicalKey: true } } } });
    if (!row) return { ok: false, refusal: 'NOT_FOUND' };
    const refusal = deleteRefusal(row.database?.logicalKey, row.properties as Record<string, unknown>);
    if (refusal) return { ok: false, refusal };
    await db.globalPage.delete({ where: { id: pageId } });
    return { ok: true };
}
