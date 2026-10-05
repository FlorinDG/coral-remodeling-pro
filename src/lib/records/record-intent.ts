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
    /**
     * A SYSTEM writer moving a document through its lifecycle (payment status sync, the overdue cron) — named, never
     * a user. It may change the LIFECYCLE fields of an accountant-exported record: an invoice exported this month
     * is paid next month (Planner 2026-10-05, R2-1-B). Every other field stays frozen.
     */
    lifecycle?: { reason: string };
}

/** What a named system lifecycle writer may still change on an accountant-exported record. */
export const EXPORT_LIFECYCLE_FIELDS: ReadonlySet<string> = new Set(['status', 'statusChangedAt', 'paidDate']);

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
    const exportBlocked = (exportViolation?.blockedFields || []).filter(f => !(ctx.lifecycle && EXPORT_LIFECYCLE_FIELDS.has(f)));
    if (exportBlocked.length) return { ok: false, refusal: { code: 'EXPORT_LOCKED', blockedFields: exportBlocked } };
    const documentViolation = checkDocumentLock(ctx.logicalKey, serverProps, merged, server.blocks, blocks);
    if (documentViolation) return { ok: false, refusal: { code: 'DOCUMENT_LOCKED', blockedFields: documentViolation.blockedFields } };

    const propsChanged = !deepEqual(merged, serverProps);
    const blocksChanged = blocks !== undefined && !deepEqual(blocks, server.blocks);
    if (blocksChanged) blocksVersion = (server.blocksVersion || 1) + 1;
    return { ok: true, properties: merged, blocks: blocksChanged ? blocks : undefined, blocksVersion, changed: propsChanged || blocksChanged, keptServer, ignored };
}

// ── The store's page → an intent (one conversion for every adapter: saveGlobalPage, saveGlobalPagesBatch) ──

export interface StorePageLike {
    id: string; databaseId: string;
    properties?: Props; dirtyBase?: Props | null; baseUpdatedAt?: string | null;
    blocks?: unknown[]; blocksVersion?: number | null; dirtyBaseBlocks?: boolean;
}

/**
 * Only the fields changed against the page's dirtyBase travel (a clean page with only a blocks edit sends no
 * field). A page without a base (never edited since load) sends its properties — the door then writes nothing
 * unless they differ.
 */
export function intentFromPage(page: StorePageLike): RecordIntent {
    const props = page.properties || {};
    const base = page.dirtyBase || undefined;
    const keys = base ? changedFields(props, base) : null;
    return {
        pageId: page.id,
        fields: keys ? Object.fromEntries(keys.map(k => [k, props[k]])) : (page.dirtyBaseBlocks ? {} : props),
        base: keys && base ? Object.fromEntries(keys.filter(k => k in base).map(k => [k, base[k]])) : undefined,
        baseUpdatedAt: page.baseUpdatedAt ?? null,
        blocks: page.dirtyBaseBlocks ? page.blocks : undefined,
        baseBlocksVersion: page.dirtyBaseBlocks ? (page.blocksVersion ?? null) : null,
    };
}

// ── Deleting a record (R2-1: the rule at the door — before, only the browser's preventDelete held it) ──

/** An issued document is never deleted: an accountant-exported record, an invoice past draft, a sent quote. */
export function deleteRefusal(logicalKey: string | null | undefined, properties: Props | null | undefined): 'EXPORT_LOCKED' | 'DOCUMENT_LOCKED' | null {
    const p = properties || {};
    if (p.accountantExportedAt === true) return 'EXPORT_LOCKED';
    const status = String(p.status ?? '');
    if (logicalKey === 'invoices' && status && status !== 'opt-draft' && status !== 'draft') return 'DOCUMENT_LOCKED';
    if (logicalKey === 'quotations' && ['opt-sent', 'opt-accepted', 'opt-rejected', 'SENT', 'ACCEPTED', 'REJECTED'].includes(status)) return 'DOCUMENT_LOCKED';
    return null;
}
