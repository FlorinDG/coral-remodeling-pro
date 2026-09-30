"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { computeWorkedDuration } from "@/lib/computeWorkedDuration";
import { isTenantHrRole } from "@/lib/roles";
import { normalizeStoredPhotos } from "@/lib/files";

export interface ShiftBriefScope {
    tenantId?: string | null;
}

export interface ShiftBriefResult {
    title: string;              // 3-step fallback, already resolved
    address: string | null;       // project Location.address
    mapUrl: string | null;       // built server-side from the address
    contactName: string | null;   // project → Klant → Naam
    contactPhone: string | null;  // project → Klant → Telefoon
    contactEmail: string | null;  // project → Klant → E-mail
    notes: string | null;         // ScheduledShift.notes — what the planner wrote for the crew
    scheduled: { start: string; end: string; date: string };
    worked: { in: string; out: string | null; minutes: number } | null;
    /** Photos from EVERY clock entry on this shift; `key` is a storage key or URL — resolve with resolveFileUrl. */
    photos: { key: string; name: string; type: string }[];
    files: { id: string; name: string; url: string; type: string }[];
}

/**
 * Server accessor for the Shift Brief modal (WH-UI-1 §8.1).
 * Resolves shift, project location, customer contact, clock entries, and attachments in one server round trip.
 */
export async function shiftBrief(
    scopeOrShiftId: ShiftBriefScope | string,
    maybeShiftId?: string
): Promise<ShiftBriefResult> {
    let tenantId: string | undefined;
    let shiftId: string;

    // The actor always comes from the session — the brief carries a client's phone and address.
    const session = await auth();
    const actorId = session?.user?.id as string | undefined;
    const actorRole = (session?.user as { role?: string } | undefined)?.role;

    if (typeof scopeOrShiftId === 'string') {
        shiftId = scopeOrShiftId;
        tenantId = session?.user?.tenantId || undefined;
    } else {
        tenantId = scopeOrShiftId?.tenantId || session?.user?.tenantId || undefined;
        shiftId = maybeShiftId!;
    }

    if (!tenantId) {
        throw new Error('Unauthorized: Tenant context missing');
    }

    if (!shiftId) {
        throw new Error('Shift ID is required');
    }

    const shift = await prisma.scheduledShift.findFirst({
        where: { id: shiftId, tenantId },
        include: {
            attachments: true,
            clockEntries: {
                orderBy: { clockInTime: 'desc' },
            },
        },
    });

    if (!shift) {
        throw new Error(`Shift not found: ${shiftId}`);
    }

    // Gate 2: a worker reads the brief of their OWN shift; HR roles read any in the tenant.
    if (!isTenantHrRole(actorRole) && shift.userId !== actorId) {
        throw new Error(`Shift not found: ${shiftId}`);
    }

    let projectName: string | null = null;
    let address: string | null = null;
    let contactName: string | null = null;
    let contactPhone: string | null = null;
    let contactEmail: string | null = null;

    if (shift.projectId) {
        // Try GlobalPage first (Dynamic DB project)
        const projectPage = await prisma.globalPage.findFirst({
            where: { id: shift.projectId, database: { tenantId } },
            select: { properties: true },
        });

        if (projectPage?.properties) {
            const props = projectPage.properties as Record<string, any>;
            projectName = (props.title || props.name || '').replace(/^\[ERP\]\s*/i, '').trim() || null;

            const loc = props.location;
            if (typeof loc === 'object' && loc && loc.address) {
                address = String(loc.address).trim();
            } else if (typeof props.address === 'string' && props.address.trim()) {
                address = props.address.trim();
            }

            const clientRel = props.client || props['prop-client'];
            const clientId = Array.isArray(clientRel) ? clientRel[0] : (typeof clientRel === 'string' ? clientRel : null);
            if (clientId) {
                const clientPage = await prisma.globalPage.findFirst({
                    where: { id: clientId, database: { tenantId } },
                    select: { properties: true },
                });
                if (clientPage?.properties) {
                    const cProps = clientPage.properties as Record<string, any>;
                    contactName = (cProps.title || cProps.name || cProps.Naam || '').trim() || null;
                    contactPhone = String(cProps.phone || cProps.telefoon || cProps.Telefoon || '').trim() || null;
                    contactEmail = String(cProps.email || cProps['e-mail'] || cProps.Email || cProps['E-mail'] || '').trim() || null;
                }
            }
        } else {
            // PROJ-SSOT-1: not a project page → the other source, InternalProject (was HrProject — empty).
            const internal = await prisma.internalProject.findFirst({
                where: { id: shift.projectId, tenantId },
                select: { name: true, projectCode: true },
            });
            if (internal) projectName = `${internal.projectCode}: ${internal.name}`;
        }
    }

    const title = projectName 
        || shift.shiftName?.trim() 
        || shift.notes?.trim() 
        || '';

    const mapUrl = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;

    let worked: { in: string; out: string | null; minutes: number } | null = null;
    let photos: { key: string; name: string; type: string }[] = [];

    const activeClockEntry = shift.clockEntries.find(e => e.clockOutTime == null) || shift.clockEntries[0];
    if (activeClockEntry) {
        const duration = computeWorkedDuration(
            activeClockEntry.clockInTime,
            activeClockEntry.clockOutTime,
            activeClockEntry.noBreak
        );

        const inIso = activeClockEntry.clockInTime instanceof Date 
            ? activeClockEntry.clockInTime.toISOString()
            : String(activeClockEntry.clockInTime);
        const outIso = activeClockEntry.clockOutTime 
            ? (activeClockEntry.clockOutTime instanceof Date ? activeClockEntry.clockOutTime.toISOString() : String(activeClockEntry.clockOutTime))
            : null;

        worked = {
            in: inIso,
            out: outIso,
            minutes: duration.totalMinutes,
        };

    }

    // Photos from every entry on this shift. ClockEntry.photos is Json? — in production it holds
    // plain storage-key strings (useClockEntries), objects ({ key|url, name, type }), or a JSON string.
    photos = shift.clockEntries.flatMap(e => normalizeStoredPhotos(e.photos));

    const files = shift.attachments.map(a => ({
        id: a.id,
        name: a.name || 'Attachment',
        url: a.url || '',
        type: a.type || 'application/octet-stream',
    }));

    return {
        title,
        address,
        mapUrl,
        contactName,
        contactPhone,
        contactEmail,
        notes: shift.notes?.trim() || null,
        scheduled: {
            start: shift.shiftStart,
            end: shift.shiftEnd,
            date: shift.shiftDate,
        },
        worked,
        photos,
        files,
    };
}

