import type { Prisma } from '@prisma/client';

export interface ExportLockViolation {
    blockedFields: string[];
}

/** Fields that describe the record's DOCUMENT, not its content.
 *  Attaching or re-attaching a file does not alter what the invoice says,
 *  so these remain writable on an accountant-exported record. */
export const ARCHIVE_FIELDS = new Set([
    'receiptUrl',
    'documentReconstructed',
    'documentReconstructedAt',
]);

const VOLATILE_BLOCK_KEYS = new Set([
    'isParentCollapsed',
    'collapsed',
    'isDragging',
    'depth',
    'isHovered',
    'cursorPos',
    '_uiState',
]);

/**
 * Normalizes a block or block tree by stripping volatile UI keys and
 * sorting object keys to ensure deterministic semantic comparison.
 */
export function normalizeBlock(block: any): any {
    if (block === null || typeof block !== 'object') return block;
    if (Array.isArray(block)) {
        return block.map(normalizeBlock);
    }
    const sortedKeys = Object.keys(block).filter(k => !VOLATILE_BLOCK_KEYS.has(k)).sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
        result[key] = normalizeBlock(block[key]);
    }
    return result;
}

export function areBlocksSemanticallyEqual(existingBlocks: unknown, incomingBlocks: unknown): boolean {
    if (!existingBlocks && !incomingBlocks) return true;
    const existingNorm = normalizeBlock(existingBlocks ?? []);
    const incomingNorm = normalizeBlock(incomingBlocks ?? []);
    return JSON.stringify(existingNorm) === JSON.stringify(incomingNorm);
}

/**
 * R1 hold-the-build safeguard:
 * Rejects writes where the server holds existing blocks and incoming is an empty array [].
 * Returns true if the write is blocked (hazard detected), false if allowed.
 */
export function isWipeHazard(existingBlocks: unknown, incomingBlocks: unknown): boolean {
    if (incomingBlocks === undefined) return false;
    const existingHasContent = Array.isArray(existingBlocks) && existingBlocks.length > 0;
    const incomingIsEmpty = Array.isArray(incomingBlocks) && incomingBlocks.length === 0;
    return existingHasContent && incomingIsEmpty;
}


/**
 * An accountant-exported record is frozen except for `accountantExportedAt`
 * itself, relation-type properties (linking is still permitted), and
 * document archive fields.
 * Blocks (invoice line items) are also strictly frozen with no exemptions.
 * Returns null when the write is allowed.
 */
export function checkExportLock(
    existingProperties: Prisma.JsonValue | null,
    incomingProperties: Record<string, unknown>,
    relationPropertyIds: Set<string>,
    existingBlocks?: Prisma.JsonValue | null,
    incomingBlocks?: unknown[]
): ExportLockViolation | null {
    const existing = (existingProperties ?? {}) as Record<string, unknown>;
    if (existing.accountantExportedAt !== true) return null;

    const blocked = Object.keys(incomingProperties).filter((key) => {
        if (key.startsWith('accountantExported') || ARCHIVE_FIELDS.has(key)) return false;
        if (relationPropertyIds.has(key)) return false;
        return JSON.stringify(incomingProperties[key]) !== JSON.stringify(existing[key]);
    });

    // Semantic block check: if incomingBlocks is provided (not undefined), any semantic change is blocked
    if (incomingBlocks !== undefined) {
        if (!areBlocksSemanticallyEqual(existingBlocks, incomingBlocks)) {
            blocked.push('blocks');
        }
    }

    return blocked.length > 0 ? { blockedFields: blocked } : null;
}


