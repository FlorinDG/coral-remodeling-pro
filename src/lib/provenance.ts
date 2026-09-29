/**
 * src/lib/provenance.ts
 * HR-TS-7: Single source of truth for entry provenance and derived self-approval.
 */

export interface ProvenanceEntry {
    createdBy?: string | null;
    approvedBy?: string | null;
}

/**
 * Derived helper: an entry is self-approved if and only if approvedBy is set,
 * createdBy is set, and approvedBy === createdBy.
 */
export function isSelfApproved(entry: ProvenanceEntry | null | undefined): boolean {
    if (!entry || !entry.approvedBy || !entry.createdBy) return false;
    return entry.approvedBy === entry.createdBy;
}
