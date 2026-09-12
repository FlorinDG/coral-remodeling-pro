import type { Prisma } from '@prisma/client';

export interface ExportLockViolation { blockedFields: string[] }

/** Fields that describe the record's DOCUMENT, not its content.
 *  Attaching or re-attaching a file does not alter what the invoice says,
 *  so these remain writable on an accountant-exported record. */
export const ARCHIVE_FIELDS = new Set([
    'receiptUrl',
    'documentReconstructed',
    'documentReconstructedAt',
]);

/**
 * An accountant-exported record is frozen except for `accountantExportedAt`
 * itself, relation-type properties (linking is still permitted), and
 * document archive fields.
 * Returns null when the write is allowed.
 */
export function checkExportLock(
    existingProperties: Prisma.JsonValue | null,
    incomingProperties: Record<string, unknown>,
    relationPropertyIds: Set<string>
): ExportLockViolation | null {
    const existing = (existingProperties ?? {}) as Record<string, unknown>;
    if (existing.accountantExportedAt !== true) return null;

    const blocked = Object.keys(incomingProperties).filter((key) => {
        if (key === 'accountantExportedAt' || ARCHIVE_FIELDS.has(key)) return false;
        if (relationPropertyIds.has(key)) return false;
        return JSON.stringify(incomingProperties[key]) !== JSON.stringify(existing[key]);
    });

    return blocked.length > 0 ? { blockedFields: blocked } : null;
}
