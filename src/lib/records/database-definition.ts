/**
 * DB-DEF-1 · a database's DEFINITION (its fields, its views, its name) changes by small OPERATIONS, never by
 * writing the whole definition back. Pure, tested (tests/database-definition.test.ts).
 *
 * Florin 2026-10-05: "sales pipe db's schema settings … don't get applied in any case." Found: ~20 store actions
 * (a filter, a sort, a hidden column, a view seeded on open, a schema edit) each sent the database's WHOLE
 * definition to `saveGlobalDatabase`, which wrote it over the server's. Any screen holding an older copy undid
 * every newer edit it did not know about — schema edits included — and a refused save showed nothing.
 *
 * Now: the store diffs before → after into operations (`diffDefinition`); the server applies them to ITS current
 * definition (`applyDefinitionOps`) in one serialized transaction. Two people editing different fields or different
 * views both land; an edit to the same element is last-writer-wins on that element only. Decision A (Florin
 * 2026-10-05): the SCHEMA decides which fields exist and what they are; each VIEW decides order and visibility.
 */

export interface DefProperty { id: string; name?: string; type?: string; config?: unknown; [k: string]: unknown }
export interface DefView { id: string; [k: string]: unknown }
export interface DefMeta { name?: string; description?: string | null; icon?: string | null; coverImage?: string | null }
export interface Definition extends DefMeta { properties: DefProperty[]; views: DefView[] }

export type DefOp =
    | { op: 'property.upsert'; property: DefProperty }
    | { op: 'property.delete'; id: string }
    | { op: 'property.order'; ids: string[] }
    | { op: 'view.upsert'; view: DefView }
    | { op: 'view.delete'; id: string }
    | { op: 'view.order'; ids: string[] }
    | { op: 'meta'; meta: DefMeta };

const META_KEYS = ['name', 'description', 'icon', 'coverImage'] as const;

/** Deep equality for JSON values (definitions are JSON). */
export function sameJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b || (a == null && b == null);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => sameJson(x, (b as unknown[])[i]));
    const ka = Object.keys(a as object).filter(k => (a as Record<string, unknown>)[k] !== undefined);
    const kb = Object.keys(b as object).filter(k => (b as Record<string, unknown>)[k] !== undefined);
    return ka.length === kb.length && ka.every(k => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function diffList<T extends { id: string }>(prev: T[], next: T[], kind: 'property' | 'view'): DefOp[] {
    const ops: DefOp[] = [];
    const before = new Map(prev.map(x => [x.id, x]));
    const after = new Set(next.map(x => x.id));
    for (const x of next) {
        const old = before.get(x.id);
        if (!old || !sameJson(old, x)) ops.push(kind === 'property' ? { op: 'property.upsert', property: x as unknown as DefProperty } : { op: 'view.upsert', view: x as unknown as DefView });
    }
    for (const x of prev) if (!after.has(x.id)) ops.push(kind === 'property' ? { op: 'property.delete', id: x.id } : { op: 'view.delete', id: x.id });
    const keptPrev = prev.map(x => x.id).filter(id => after.has(id));
    const keptNext = next.map(x => x.id).filter(id => before.has(id));
    if (!sameJson(keptPrev, keptNext)) ops.push(kind === 'property' ? { op: 'property.order', ids: next.map(x => x.id) } : { op: 'view.order', ids: next.map(x => x.id) });
    return ops;
}

/** What changed from `prev` to `next`, as operations. Empty when nothing did (no write at all). */
export function diffDefinition(prev: Definition, next: Definition): DefOp[] {
    const ops = [...diffList(prev.properties || [], next.properties || [], 'property'), ...diffList(prev.views || [], next.views || [], 'view')];
    const meta: DefMeta = {};
    for (const k of META_KEYS) if (next[k] !== undefined && !sameJson(prev[k], next[k])) (meta as Record<string, unknown>)[k] = next[k];
    if (Object.keys(meta).length) ops.push({ op: 'meta', meta });
    return ops;
}

/** Order `list` by `ids`: the listed ones first in that order, then the ones the list did not know, in place. */
function reorder<T extends { id: string }>(list: T[], ids: string[]): T[] {
    const byId = new Map(list.map(x => [x.id, x]));
    const head = ids.map(id => byId.get(id)).filter((x): x is T => !!x);
    const seen = new Set(head.map(x => x.id));
    return [...head, ...list.filter(x => !seen.has(x.id))];
}

export interface ApplyGuard {
    /** Canonical field ids of a system database (kernel system-schemas) — never deleted, never retyped. */
    canonicalIds?: Set<string>;
    /** Superadmin support edits may retype / delete canonical fields. */
    allowSystemEdit?: boolean;
}

export type DefRefusal = 'canonical_field_delete' | 'canonical_field_retype' | 'title_field' | 'last_view' | 'invalid';

/**
 * Apply operations to the CURRENT definition. Refused operations are skipped and reported (the caller tells the
 * user — a refused edit is never silent). `changed` says which columns need writing.
 */
export function applyDefinitionOps(current: Definition, ops: DefOp[], guard: ApplyGuard = {}):
    { next: Definition; refused: Array<{ op: DefOp['op']; id?: string; reason: DefRefusal }>; changed: { properties: boolean; views: boolean; meta: boolean } } {
    let properties = [...(current.properties || [])];
    let views = [...(current.views || [])];
    const meta: DefMeta = {};
    const refused: Array<{ op: DefOp['op']; id?: string; reason: DefRefusal }> = [];
    const canonical = guard.canonicalIds || new Set<string>();
    for (const o of ops) {
        switch (o.op) {
            case 'property.upsert': {
                if (!o.property?.id) { refused.push({ op: o.op, reason: 'invalid' }); break; }
                const i = properties.findIndex(p => p.id === o.property.id);
                if (i < 0) { properties.push(o.property); break; }
                const old = properties[i];
                if (canonical.has(old.id) && !guard.allowSystemEdit && o.property.type !== undefined && o.property.type !== old.type) {
                    refused.push({ op: o.op, id: old.id, reason: 'canonical_field_retype' }); break;
                }
                properties[i] = o.property;
                break;
            }
            case 'property.delete': {
                if (o.id === 'title') { refused.push({ op: o.op, id: o.id, reason: 'title_field' }); break; }
                if (canonical.has(o.id) && !guard.allowSystemEdit) { refused.push({ op: o.op, id: o.id, reason: 'canonical_field_delete' }); break; }
                properties = properties.filter(p => p.id !== o.id);
                break;
            }
            case 'property.order': properties = reorder(properties, o.ids || []); break;
            case 'view.upsert': {
                if (!o.view?.id) { refused.push({ op: o.op, reason: 'invalid' }); break; }
                const i = views.findIndex(v => v.id === o.view.id);
                if (i < 0) views.push(o.view); else views[i] = o.view;
                break;
            }
            case 'view.delete': {
                if (views.length <= 1 && views.some(v => v.id === o.id)) { refused.push({ op: o.op, id: o.id, reason: 'last_view' }); break; }
                views = views.filter(v => v.id !== o.id);
                break;
            }
            case 'view.order': views = reorder(views, o.ids || []); break;
            case 'meta': Object.assign(meta, o.meta || {}); break;
        }
    }
    const next: Definition = { ...current, ...meta, properties, views };
    return {
        next,
        refused,
        changed: {
            properties: !sameJson(current.properties || [], properties),
            views: !sameJson(current.views || [], views),
            meta: META_KEYS.some(k => meta[k] !== undefined && !sameJson(current[k], meta[k])),
        },
    };
}
