/**
 * OCC · the 3-way merge of a STALE write (the client saved on an older version of the row).
 * ONE implementation, read by saveGlobalPage and saveGlobalPagesBatch (it was copied inline in both).
 *
 * Per field, against the BASE (the row as the client last had it):
 *   client changed, server not      → client's value
 *   server changed, client not      → server's value          (was: client's stale value — a silent stomp)
 *   both changed, to the same value → that value
 *   both changed, differently       → conflict (derived totals excepted: the client's recomputation wins)
 *   neither changed                 → server's value
 * A key the base does not know is treated as changed on whichever side has it — with no base at all
 * this reduces to the old rule (any difference = conflict), so a client without a base is never
 * silently merged.
 */
export const DERIVED_PROPERTY_KEYS = new Set(['totalVat', 'totalExVat', 'totalIncVat', 'margin', 'totalCost', 'totalProfit']);

export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            return a.every((v, i) => deepEqual(v, b[i]));
        }
        if (Array.isArray(b)) return false;
        const ka = Object.keys(a as object), kb = Object.keys(b as object);
        if (ka.length !== kb.length) return false;
        return ka.every(k => kb.includes(k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
    }
    return false;
}

export type StaleMerge =
    | { conflict: true; key: string }
    | { conflict: false; merged: Record<string, unknown>; tookServer: string[] };

export function mergeStaleWrite(
    server: Record<string, unknown>,
    client: Record<string, unknown>,
    base: Record<string, unknown> | null | undefined,
): StaleMerge {
    const b = base || {};
    const merged: Record<string, unknown> = { ...server };
    const tookServer: string[] = [];
    for (const key of Object.keys(client)) {
        const clientChanged = !(key in b) || !deepEqual(client[key], b[key]);
        const serverChanged = !(key in b) ? key in server : !deepEqual(server[key], b[key]);
        if (deepEqual(client[key], server[key])) continue;          // same value — nothing to decide
        if (clientChanged && serverChanged) {
            if (DERIVED_PROPERTY_KEYS.has(key)) { merged[key] = client[key]; continue; }
            return { conflict: true, key };
        }
        if (clientChanged) merged[key] = client[key];
        else tookServer.push(key);                                    // the other edit is kept
    }
    return { conflict: false, merged, tookServer };
}
