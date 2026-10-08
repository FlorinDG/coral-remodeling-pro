/**
 * HR-SERAPH-1 B8 · undoing a cost-rate restamp: the snapshot grouped by its old rate, so the undo is one bulk update per
 * distinct rate (a handful) instead of one round trip per entry inside the transaction. Pure.
 */
export function groupSnapshotByRate(
    snapshot: Array<{ entryId: string; oldRate: number | null }>
): Map<number | null, string[]> {
    const rateGroups = new Map<number | null, string[]>();
    for (const item of snapshot) {
        const existing = rateGroups.get(item.oldRate);
        if (existing) {
            existing.push(item.entryId);
        } else {
            rateGroups.set(item.oldRate, [item.entryId]);
        }
    }
    return rateGroups;
}
