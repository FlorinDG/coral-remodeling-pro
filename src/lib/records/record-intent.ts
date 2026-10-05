/**
 * R2-1 / R2-2 · ONE record write rule — a save is an INTENT for the fields that changed, applied to the server's
 * CURRENT row. Pure, tested (tests/record-intent.test.ts). The core door (lib/data/records.ts) runs it inside one
 * serializable transaction; every adapter (saveGlobalPage, updatePageServerFirst, …) calls that door.
 *
 * What it owns, in one place (coral-r2-write-path.md R2-1 … R2-3, coral-r3-grid.md R3-B2 "record rules move DOWN"):
 *   - only CHANGED fields travel: `{ fields, base }` — two people editing different fields of a row both land;
 *   - the stale-write merge (lib/records/occ-merge.ts — the one merge rule) when the client's version is old;
 *   - blocks: a whole-tree write guarded by blocksVersion, and never an empty tree over existing lines;
 *   - computed fields (rollup / formula / comments / created & edited times) are never written by a client —
 *     they are IGNORED and reported, not silently kept;
 *   - the accountant-export lock and the document lock (lib/records/export-lock.ts, document-lock.ts).
 */
import { deepEqual, mergeStaleWrite } from './occ-merge';
import { checkExportLock, isWipeHazard } from './export-lock';
import { checkDocumentLock } from './document-lock';

type Props = Record<string, unknown>;

/** The keys whose value differs from the base (a key the base does not know counts as changed). */
export function changedFields(current: Props, base: Props | null | undefined): string[] {
    if (!base) return Object.keys(current);
    return Object.keys(current).filter(k => !(k in base) || !deepEqual(current[k], base[k]));
}

/** Field types a client never writes: computed on read, or stamped by the server. */
export const COMPUTED_TYPES: ReadonlySet<string> = new Set(['rollup', 'formula', 'comments', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by']);

export interface RecordIntent {
    pageId: string;
    /** the fields this save changes (values) — only these are written */
    fields?: Props;
    /** the same fields as the client last had them from the server (for the stale-write merge) */
    base?: Props;
    /** the server version the client edited from (ISO) */
    baseUpdatedAt?: string | null;
    /** a whole new blocks tree, written only when the version matches */
    blocks?: unknown[];
    baseBlocksVersion?: number | null;
}

export interface ServerRow { properties: Props; blocks: unknown; blocksVersion: number; updatedAt: string }
export interface WriteContext {
    dbProperties: Array<{ id: string; type?: string; name?: string }>;
    logicalKey?: string | null;
}

export type RecordRefusal =
    | { code: 'STALE_WRITE'; field?: string }
    | { code: 'EMPTY_BLOCKS_PROTECTION' }
    | { code: 'EXPORT_LOCKED' | 'DOCUMENT_LOCKED'; blockedFields: string[] };

export type RecordApply =
    | { ok: true; properties: Props; blocks?: unknown[]; blocksVersion: number; changed: boolean; keptServer: string[]; ignored: string[] }
    | { ok: false; refusal: RecordRefusal };

/** Apply an intent to the server's current row. No I/O; the caller writes `properties` / `blocks` when `changed`. */
export function applyRecordIntent(server: ServerRow, intent: RecordIntent, ctx: WriteContext): RecordApply {
    const typeOf = new Map(ctx.dbProperties.map(p => [p.id, p.type || '']));
    const ignored: string[] = [];
    const fields: Props = {};
    for (const [k, v] of Object.entries(intent.fields || {})) {
        if (COMPUTED_TYPES.has(typeOf.get(k) || '')) { ignored.push(k); continue; }
        fields[k] = v;
    }
    const serverProps = server.properties || {};

    // Blocks: a whole tree, versioned. Never an empty tree over existing lines.
    let blocks: unknown[] | undefined;
    let blocksVersion = server.blocksVersion || 1;
    if (intent.blocks !== undefined) {
        if (isWipeHazard(server.blocks, intent.blocks)) return { ok: false, refusal: { code: 'EMPTY_BLOCKS_PROTECTION' } };
        if (intent.baseBlocksVersion != null && intent.baseBlocksVersion !== server.blocksVersion) return { ok: false, refusal: { code: 'STALE_WRITE' } };
        blocks = intent.blocks;
    }

    // Fields: on the current row; when the client's version is old, the one merge rule decides per field.
    let merged: Props = { ...serverProps };
    let keptServer: string[] = [];
    const stale = !!intent.baseUpdatedAt && intent.baseUpdatedAt !== server.updatedAt;
    if (stale && Object.keys(fields).length) {
        const m = mergeStaleWrite(serverProps, fields, intent.base);
        if (m.conflict) return { ok: false, refusal: { code: 'STALE_WRITE', field: m.key } };
        merged = m.merged;
        keptServer = m.tookServer;
    } else {
        for (const [k, v] of Object.entries(fields)) merged[k] = v;
    }

    // Locks — on the prospective result, against the current row.
    const relationIds = new Set(ctx.dbProperties.filter(p => p.type === 'relation').map(p => p.id));
    const exportViolation = checkExportLock(serverProps as never, merged, relationIds, server.blocks as never, blocks);
    if (exportViolation) return { ok: false, refusal: { code: 'EXPORT_LOCKED', blockedFields: exportViolation.blockedFields } };
    const documentViolation = checkDocumentLock(ctx.logicalKey, serverProps, merged, server.blocks, blocks);
    if (documentViolation) return { ok: false, refusal: { code: 'DOCUMENT_LOCKED', blockedFields: documentViolation.blockedFields } };

    const propsChanged = !deepEqual(merged, serverProps);
    const blocksChanged = blocks !== undefined && !deepEqual(blocks, server.blocks);
    if (blocksChanged) blocksVersion = (server.blocksVersion || 1) + 1;
    return { ok: true, properties: merged, blocks: blocksChanged ? blocks : undefined, blocksVersion, changed: propsChanged || blocksChanged, keptServer, ignored };
}
