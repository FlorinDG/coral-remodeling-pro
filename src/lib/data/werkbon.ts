/**
 * WO-4b · the signed work order PDF ("werkbon") — generated from the FROZEN signing evidence, stored ONCE.
 * Core door on the seraph's system scope (the tenant is the signing tenant; nothing else is reachable).
 * Plan: .agents/plans/WO-4b.md. Rules: lib/records/werkbon-input.ts + werkbon-number.ts (pure, tested).
 *
 * State is append-only facts (AuditLog on the anchor shift), the same pattern as the signing lock:
 *   'werkbon-pdf' (key, number, fileName, language) · later 'werkbon-approve' · 'werkbon-sent'.
 * Never re-rendered once stored: approving and sending use the stored bytes.
 */
import { storage } from '@/lib/storage';
import { platformDb, systemScope, type TenantScopedClient } from '@/lib/data/scope';
import { werkbonStatus, type WerkbonStatus } from '@/lib/records/werkbon-status';
import { workOrderMembers } from '@/lib/data/work-order-lock';
import { renderSignedWorkOrderPdf } from '@/lib/documents/work-order-pdf';
import { documentLanguage, addressLine, linesFromEvidence, type SignEvidenceEntry } from '@/lib/records/werkbon-input';
import { werkbonFileName } from '@/lib/records/werkbon-number';
import { zonedParts } from '@/lib/kernel/shift-time';
import { buildAuditLogData, buildAuditLogOperation } from '@/lib/audit';

type Props = Record<string, unknown>;
interface SignEvidence { signerName: string; signatureKey: string; signedAt: string; shiftIds: string[]; entries: SignEvidenceEntry[]; number?: string }

export type WerkbonResult = { ok: true; key: string; number: string; fileName: string; already?: boolean } | { ok: false; error: string };

/**
 * Generate the PDF for a signed work order (any of its shifts). Idempotent: a work order that already has its
 * PDF returns the existing one. `signaturePng` — the bytes just signed (saves a storage read at signing time).
 */
export async function generateWerkbon(tenantId: string, shiftId: string, opts: { signaturePng?: Buffer; byUserId?: string } = {}): Promise<WerkbonResult> {
    const wo = await workOrderMembers(tenantId, shiftId);
    if (!wo) return { ok: false, error: 'not_found' };
    const ids = wo.members.map(m => m.id);
    const anchorId = wo.anchor.id;
    const db = systemScope(tenantId, `werkbon pdf for work order ${anchorId}`);

    const [signRow, pdfRow] = await Promise.all([
        db.auditLog.findFirst({ where: { entityType: 'shift', entityId: { in: ids }, action: 'sign' }, select: { after: true } }),
        db.auditLog.findFirst({ where: { entityType: 'shift', entityId: anchorId, action: 'werkbon-pdf' }, select: { after: true } }),
    ]);
    if (!signRow) return { ok: false, error: 'not_signed' };
    if (pdfRow) {
        const p = pdfRow.after as { key: string; number: string; fileName: string };
        return { ok: true, key: p.key, number: p.number, fileName: p.fileName, already: true };
    }
    const ev = signRow.after as unknown as SignEvidence;
    if (!ev?.number) return { ok: false, error: 'no_number' };   // signed before WO-4b numbering

    const [anchor, members, users, tenant] = await Promise.all([
        db.scheduledShift.findFirst({ where: { id: anchorId }, select: { notes: true, siteAddress: true, projectId: true, contactPageId: true } }),
        db.scheduledShift.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, crewNote: true } }),
        db.user.findMany({ where: { id: { in: wo.members.map(m => m.userId) } }, select: { id: true, name: true } }),
        platformDb().tenant.findUnique({ where: { id: tenantId }, select: { companyName: true, vatNumber: true, street: true, postalCode: true, city: true, logoUrl: true, brandColor: true } }),
    ]);
    if (!anchor || !tenant) return { ok: false, error: 'not_found' };
    const nameOf = (uid?: string) => users.find(u => u.id === uid)?.name || '—';

    // The order giver: the shift's client, else the project's client (Florin 2026-10-04; END-CLIENT-1).
    const project = anchor.projectId
        ? await db.globalPage.findFirst({ where: { id: anchor.projectId, database: { logicalKey: 'projects' } }, select: { properties: true } })
        : null;
    const projectProps = (project?.properties || null) as Props | null;
    const projectClient = projectProps?.['prop-client'];
    const clientId = anchor.contactPageId || (Array.isArray(projectClient) ? (projectClient[0] as string) : (typeof projectClient === 'string' ? projectClient : null));
    const client = clientId
        ? await db.globalPage.findFirst({ where: { id: clientId, database: { logicalKey: 'clients' } }, select: { properties: true } })
        : null;
    const clientProps = (client?.properties || null) as Props | null;
    const language = documentLanguage(clientProps);

    // Tasks of the member shifts — done = reported done by the worker.
    const shiftTasks = await db.shiftTask.findMany({ where: { shiftId: { in: ids } }, select: { taskId: true, status: true } });
    const taskPages = shiftTasks.length
        ? await db.globalPage.findMany({ where: { id: { in: shiftTasks.map(t => t.taskId) } }, select: { id: true, properties: true } })
        : [];
    const tasks = shiftTasks.map(t => ({
        title: String((taskPages.find(p => p.id === t.taskId)?.properties as Props | undefined)?.title ?? 'Taak'),
        done: t.status === 'done_by_worker',
    }));

    const signaturePng = opts.signaturePng ?? await storage.read(ev.signatureKey);
    const date = zonedParts(ev.signedAt).date;
    const pdf = await renderSignedWorkOrderPdf({
        tenant: {
            name: tenant.companyName,
            vatNumber: tenant.vatNumber,
            address: [tenant.street, [tenant.postalCode, tenant.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
            logoUrl: tenant.logoUrl,
            brandColor: tenant.brandColor,
        },
        client: clientProps ? { name: String(clientProps.title ?? ''), address: addressLine(clientProps) } : null,
        workOrder: {
            reference: ev.number,
            date,
            siteAddress: anchor.siteAddress || addressLine(projectProps),
            projectName: projectProps ? String(projectProps.title ?? '') || null : null,
        },
        lines: linesFromEvidence(ev.entries, nameOf),
        tasks,
        description: anchor.notes || null,   // printed: the shift description (§14) — admin notes never print
        crewNotes: members.filter(m => m.crewNote?.trim()).map(m => ({ workerName: nameOf(m.userId), note: m.crewNote!.trim() })),
        signature: { signerName: ev.signerName, signedAt: ev.signedAt, imagePng: signaturePng },
        language,
    });

    const fileName = werkbonFileName(ev.number, date, language);
    const key = `t_${tenantId}/hr-shift/${anchorId}/${fileName}`;
    const put = await storage.put(key, pdf, { contentType: 'application/pdf' });
    const storedKey = put.key || key;
    await db.shiftAttachment.create({ data: { shiftId: anchorId, name: fileName, url: storedKey, type: 'application/pdf', size: pdf.length } });
    const audit = await buildAuditLogData({ tenantId, userId: opts.byUserId }, {
        entityType: 'shift', entityId: anchorId, action: 'werkbon-pdf', field: null,
        before: null, after: { key: storedKey, number: ev.number, fileName, language }, reason: 'signed work order PDF',
    });
    await buildAuditLogOperation(db, audit);   // on the tenant scope, like every other write here
    // Privacy (Florin 2026-10-05): the signature is never kept as a file of its own. It lives in the signed PDF;
    // the raw image is deleted once the PDF is stored (kept only until then, so a failed PDF can be regenerated).
    await storage.delete(ev.signatureKey).catch(err => console.error(`[werkbon] signature ${ev.signatureKey} not deleted:`, err));
    return { ok: true, key: storedKey, number: ev.number, fileName };
}

/**
 * The status of the work order a shift belongs to — read from its facts on the given scoped client (the caller's
 * door: scopeFromSession for the office). Signature on the member shifts; PDF and sends on whichever member is the
 * anchor (the shift the signing was made from), so all three are read across the members.
 */
export async function readWerkbonStatus(db: TenantScopedClient, tenantId: string, shiftId: string): Promise<WerkbonStatus | null> {
    const wo = await workOrderMembers(tenantId, shiftId);
    if (!wo) return null;
    const ids = wo.members.map(m => m.id);
    const rows = await db.auditLog.findMany({
        where: { entityType: 'shift', entityId: { in: ids }, action: { in: ['sign', 'werkbon-pdf', 'werkbon-sent'] } },
        select: { action: true, after: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });
    return werkbonStatus({
        sign: rows.find(r => r.action === 'sign') || null,
        pdf: rows.find(r => r.action === 'werkbon-pdf') || null,
        sent: rows.filter(r => r.action === 'werkbon-sent'),
    });
}
