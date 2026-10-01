"use server";
/**
 * WO-1 · the crew attaches files (photos, documents) to THEIR shift — the work order's Files tab.
 *
 * The file itself is uploaded first with `uploadFileAction(formData, 'hr-shift', shiftId)` (the crew
 * file fence allows that context); this records it on the shift. Reach is checked here, on the
 * parent: the shift must be the actor's own (or the actor holds a tenant HR role) and not yet
 * submitted — the generic HR route does not check reach on shift attachments (GATE-2b).
 */
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { isTenantHrRole } from '@/lib/roles';
import { isShiftSubmitted } from '@/lib/kernel/shift-time';

export async function addShiftFile(input: { shiftId: string; key: string; name: string; type: string; size: number | null }):
    Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !userId) return { ok: false, error: 'unauthorized' };

    const shift = await prisma.scheduledShift.findFirst({
        where: { id: input.shiftId, tenantId },
        select: { id: true, userId: true, status: true },
    });
    const hr = isTenantHrRole(role);
    if (!shift || (!hr && shift.userId !== userId)) return { ok: false, error: 'not_found' };
    if (isShiftSubmitted(shift.status) && !hr) return { ok: false, error: 'shift_submitted' };
    // The key must be one our upload produced for this tenant — never a URL from elsewhere.
    // Key scheme of uploadFileAction: t_{tenantId}/{recordType}/{recordId}/{filename}.
    if (!String(input.key || '').startsWith(`t_${tenantId}/hr-shift/${shift.id}/`)) return { ok: false, error: 'bad_file' };

    const row = await prisma.shiftAttachment.create({
        data: {
            shiftId: shift.id,
            name: String(input.name || 'file').slice(0, 255),
            url: input.key,
            type: String(input.type || 'application/octet-stream').slice(0, 120),
            size: typeof input.size === 'number' ? input.size : null,
        },
        select: { id: true },
    });
    return { ok: true, id: row.id };
}

/** WO-2 · the crew member's note on THEIR open shift (office instructions stay in `notes`). */
export async function saveCrewNote(shiftId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await auth();
    const tenantId = session?.user?.tenantId;
    const userId = session?.user?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!tenantId || !userId) return { ok: false, error: 'unauthorized' };
    const shift = await prisma.scheduledShift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true, userId: true, status: true } });
    const hr = isTenantHrRole(role);
    if (!shift || (!hr && shift.userId !== userId)) return { ok: false, error: 'not_found' };
    if (isShiftSubmitted(shift.status) && !hr) return { ok: false, error: 'shift_submitted' };
    await prisma.scheduledShift.update({ where: { id: shift.id }, data: { crewNote: String(text || '').slice(0, 10_000).trim() || null } });
    return { ok: true };
}
