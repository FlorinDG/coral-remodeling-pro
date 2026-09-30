/**
 * What the CREW may do with tenant files — pure, tested (tests/crew-file-policy.test.ts).
 *
 * Found 2026-09-30: every file action checked only the tenant prefix, so any logged-in user —
 * including a crew phone — could list every invoice, receipt and quote PDF (`listAllTenantFiles`,
 * `listRecordFiles(type)` without an id), delete any file, and overwrite any file by path.
 * The crew app is the untrusted surface; this fences it to what the crew app actually does.
 * Office roles are unchanged (recorded as FILES-GATE-1 for Florin).
 */

/** Where crew uploads land: clock-out photos, late entries, shift attachments, task-note photos (TASK-CREW-1). */
export const CREW_UPLOAD_RECORD_TYPES: ReadonlySet<string> = new Set(['hr', 'shifts', 'hr-shift', 'schedules', 'task-notes']);

/** The one shared folder the crew may browse (WorkHub → Documents). */
export const CREW_SHARED_DOCS = { recordType: 'global', recordId: 'workhub-shared' } as const;

export type FileOp = 'list' | 'listAll' | 'upload' | 'delete';

/** null = allowed; otherwise the reason, for a named refusal. */
export function crewFileRefusal(op: FileOp, recordType?: string, recordId?: string): string | null {
    switch (op) {
        case 'listAll':
            return 'crew may not list tenant files';
        case 'delete':
            return 'crew may not delete files';
        case 'list':
            return recordType === CREW_SHARED_DOCS.recordType && recordId === CREW_SHARED_DOCS.recordId
                ? null
                : `crew may only browse the shared crew documents (asked: ${recordType}/${recordId ?? '*'})`;
        case 'upload':
            return recordType && CREW_UPLOAD_RECORD_TYPES.has(recordType)
                ? null
                : `crew may not upload to "${recordType}"`;
    }
}
