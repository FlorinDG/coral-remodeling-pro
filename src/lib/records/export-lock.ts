import type { Prisma } from '@prisma/client';

export interface ExportLockViolation { blockedFields: string[] }

/**
 * An accountant-exported record is frozen except for `accountantExportedAt`
 * itself and relation-type properties (linking is still permitted).
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
        if (key === 'accountantExportedAt') return false;
        if (relationPropertyIds.has(key)) return false;
        return JSON.stringify(incomingProperties[key]) !== JSON.stringify(existing[key]);
    });

    return blocked.length > 0 ? { blockedFields: blocked } : null;
}
